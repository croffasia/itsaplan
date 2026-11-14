import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { markSignedIn } from '@/lib/api/core/client';
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
const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'Event',
  'fetch',
] as const;

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
  // signOut marks lib/api as signing out, which would mute its 401 handling in later files.
  markSignedIn();
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

  it('turns push off in this browser while the session still lets the api forget it', async () => {
    const paths: string[] = [];
    let unsubscribed = false;
    const subscription = {
      endpoint: 'https://push.example.test/1',
      unsubscribe: async () => (unsubscribed = true),
    };
    const pushManager = { getSubscription: async () => subscription };
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { serviceWorker: { getRegistration: async () => ({ pushManager }) } },
    });
    Object.assign(dom.window, { PushManager: class {}, Notification: class {} });
    answer = (url) => {
      paths.push(new URL(url).pathname);
      return url.endsWith('/sign-out')
        ? Response.json({ success: true })
        : new Response(null, { status: 204 });
    };

    await signOut();

    assert.deepEqual(paths, ['/push/subscriptions', '/api/auth/sign-out']);
    assert.equal(unsubscribed, true);
    assert.equal(navigations, 1);
  });

  it('clears the push flag of this browser, so its desktop notifications come back', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: dom.window.localStorage,
    });
    Object.defineProperty(globalThis, 'Event', { configurable: true, value: dom.window.Event });
    dom.window.localStorage.setItem('pushNotifications', 'on');

    await signOut();

    assert.equal(dom.window.localStorage.getItem('pushNotifications'), null);
  });

  it('drops the push subscription of this browser even when the api cannot be reached', async () => {
    let unsubscribed = false;
    const subscription = {
      endpoint: 'https://push.example.test/1',
      unsubscribe: async () => (unsubscribed = true),
    };
    const pushManager = { getSubscription: async () => subscription };
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { serviceWorker: { getRegistration: async () => ({ pushManager }) } },
    });
    Object.assign(dom.window, { PushManager: class {}, Notification: class {} });
    answer = (url) => {
      if (url.endsWith('/push/subscriptions')) throw new TypeError('Failed to fetch');
      return Response.json({ success: true });
    };

    await signOut();

    assert.equal(unsubscribed, true);
    assert.equal(navigations, 1);
  });
});
