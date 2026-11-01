import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { authBaseURL } from './auth-client';

describe('authBaseURL', () => {
  it('adds the better-auth mount to an API_URL that is an origin', () => {
    assert.equal(authBaseURL('https://api.example.com'), 'https://api.example.com/api/auth');
  });

  it('keeps the path of an API_URL served under a prefix', () => {
    assert.equal(
      authBaseURL('https://app.example.com/api'),
      'https://app.example.com/api/api/auth',
    );
    assert.equal(
      authBaseURL('https://app.example.com/api/'),
      'https://app.example.com/api/api/auth',
    );
  });
});

// signOut takes the app down and leaves the page itself, so no caller navigates inside
// an app whose session is gone.
const replacedGlobals = ['window', 'document', 'fetch'] as const;

let dom: JSDOM;
let originals: Map<string, PropertyDescriptor | undefined>;
let signOut: typeof import('./auth-client').signOut;
let isSigningOut: typeof import('./auth-client').isSigningOut;
let signingOutAtRequest: boolean | null;
// jsdom does not load other documents; it reports each attempt instead.
let navigations: number;

// better-auth keeps the fetch it finds when the client is created, and other test files
// may have created the shared one already, so this file loads its own copy over a fetch
// that answers through `answer`.
let answer: (url: string) => Response;

function fakeFetch(input: string | URL | Request) {
  return Promise.resolve(answer(input instanceof Request ? input.url : String(input)));
}

before(async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fakeFetch });
  const ownCopy = './auth-client.ts?sign-out-test';
  ({ signOut, isSigningOut } = (await import(ownCopy)) as typeof import('./auth-client'));
  if (original) Object.defineProperty(globalThis, 'fetch', original);
});

beforeEach(() => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  navigations = 0;
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    if (error.message.includes('navigation')) navigations++;
  });
  dom = new JSDOM('<!doctype html>', { url: 'https://example.test/acme/MKT', virtualConsole });
  for (const name of ['window', 'document'] as const) {
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  }
  signingOutAtRequest = null;
  answer = (url) => {
    if (!url.endsWith('/sign-out')) return Response.json(null);
    signingOutAtRequest = isSigningOut();
    return Response.json({ success: true });
  };
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fakeFetch });
});

afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (globalThis as Record<string, unknown>)[name];
  }
  dom.window.close();
});

describe('signOut', () => {
  it('takes the app down before the session goes, and keeps it down while leaving', async () => {
    await signOut();

    assert.equal(signingOutAtRequest, true);
    assert.equal(isSigningOut(), true);
  });

  it('loads the next page as a full load, /login or the same page', async () => {
    await signOut();
    assert.equal(navigations, 1);

    await signOut('here');
    assert.equal(navigations, 2);
  });

  it('leaves even when the sign-out request fails', async () => {
    answer = () => {
      throw new TypeError('Failed to fetch');
    };

    await signOut();

    assert.equal(navigations, 1);
  });
});
