import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';

// public/sw.js runs in a service worker, so it is evaluated here against a stand-in for its
// global scope: the push it shows, and the window a click on it focuses or opens.

const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://planner.test';

type Listener = (event: Record<string, unknown>) => void;

interface FakeWindow {
  focused: boolean;
  focus: () => Promise<FakeWindow>;
  navigate: (url: string) => Promise<FakeWindow>;
}

let listeners: Map<string, Listener>;
let shown: { title: string; options: Record<string, unknown> }[];
let windows: FakeWindow[];
let actions: string[];

function appWindow(focused = false): FakeWindow {
  const win: FakeWindow = {
    focused,
    focus: async () => (actions.push('focus'), win),
    navigate: async (url) => (actions.push(`navigate ${url}`), win),
  };
  return win;
}

beforeEach(() => {
  listeners = new Map();
  shown = [];
  windows = [];
  actions = [];
  const scope = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: async () => {},
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) =>
        void shown.push({ title, options }),
    },
    clients: {
      claim: async () => {},
      matchAll: async () => windows,
      openWindow: async (url: string) => void actions.push(`open ${url}`),
    },
  };
  runInNewContext(source, { self: scope, URL });
});

// Runs one event through the worker and waits for what it handed to waitUntil.
async function dispatch(type: string, event: Record<string, unknown>) {
  let pending: Promise<unknown> = Promise.resolve();
  listeners.get(type)!({ ...event, waitUntil: (work: Promise<unknown>) => (pending = work) });
  await pending;
}

const push = (data: string) =>
  dispatch('push', {
    data: { json: () => JSON.parse(data), text: () => data },
  });

const click = (url: unknown) =>
  dispatch('notificationclick', { notification: { data: { url }, close: () => {} } });

describe('sw.js', () => {
  it('shows a push with its tag, its url and the app icon', async () => {
    await push(
      JSON.stringify({
        title: 'MKT-7 Fix login',
        body: 'Mentioned by Ada',
        url: `${ORIGIN}/acme/issue/MKT-7`,
        tag: 'inbox-12',
      }),
    );

    assert.deepEqual(shown, [
      {
        title: 'MKT-7 Fix login',
        options: {
          body: 'Mentioned by Ada',
          tag: 'inbox-12',
          data: { url: `${ORIGIN}/acme/issue/MKT-7` },
          icon: '/icon-192.png',
        },
      },
    ]);
  });

  it('shows a plain text push, as DevTools sends one, as the body', async () => {
    await push('Test push message from DevTools.');

    assert.equal(shown[0]!.options.body, 'Test push message from DevTools.');
  });

  it('focuses an open window of the app and takes it to the item', async () => {
    windows = [appWindow(), appWindow(true)];

    await click(`${ORIGIN}/acme/issue/MKT-7#comment-5`);

    assert.deepEqual(actions, ['focus', `navigate ${ORIGIN}/acme/issue/MKT-7#comment-5`]);
  });

  it('opens a window at the item when none is open', async () => {
    await click(`${ORIGIN}/acme/issue/MKT-7`);

    assert.deepEqual(actions, [`open ${ORIGIN}/acme/issue/MKT-7`]);
  });

  it('opens the start page for a url outside the app', async () => {
    await click('https://elsewhere.test/phish');
    await click(undefined);

    assert.deepEqual(actions, ['open /', 'open /']);
  });
});
