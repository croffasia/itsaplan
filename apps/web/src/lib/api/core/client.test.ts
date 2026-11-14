import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { markSignedIn, request } from './client';

// A 401 means the session behind the cookie is gone. The browser signs out and leaves for
// the expired screen, and it drops its push subscription on the way, so the ended
// session's notifications stop reaching it.

const replacedGlobals = ['window', 'document', 'navigator', 'localStorage', 'Event', 'fetch'];

let dom: JSDOM;
let originals: Map<string, PropertyDescriptor | undefined>;
let navigations: number;
let paths: string[];
let unsubscribed: boolean;

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

beforeEach(() => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  navigations = 0;
  paths = [];
  unsubscribed = false;
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    if (error.message.includes('navigation')) navigations++;
  });
  dom = new JSDOM('<!doctype html>', { url: 'https://planner.test/acme/MKT', virtualConsole });
  const subscription = {
    endpoint: 'https://push.example.test/1',
    unsubscribe: async () => (unsubscribed = true),
  };
  const pushManager = { getSubscription: async () => subscription };
  Object.assign(dom.window, { PushManager: class {} });
  setGlobal('window', dom.window);
  setGlobal('document', dom.window.document);
  setGlobal('navigator', { serviceWorker: { getRegistration: async () => ({ pushManager }) } });
  setGlobal('localStorage', dom.window.localStorage);
  setGlobal('Event', dom.window.Event);
  setGlobal('fetch', async (input: string) => {
    const path = new URL(input).pathname;
    paths.push(path);
    if (path === '/api/auth/sign-out') return Response.json({ success: true });
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  });
  dom.window.localStorage.setItem('pushNotifications', 'on');
});

afterEach(() => {
  // endSession marks the client as signing out, which would mute the 401s of later files.
  markSignedIn();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  dom.window.close();
});

describe('an ended session', () => {
  it('drops the push subscription of this browser and its flag on the way out', async () => {
    await assert.rejects(request('/projects'));
    for (let i = 0; i < 20 && navigations === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    assert.deepEqual(paths, ['/projects', '/api/auth/sign-out']);
    assert.equal(unsubscribed, true);
    assert.equal(dom.window.localStorage.getItem('pushNotifications'), null);
    assert.equal(navigations, 1);
  });
});
