import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { environmentManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SyncProvider } from '@/context/syncContext';
import documents from '../../messages/en/documents.json';
import inbox from '../../messages/en/inbox.json';
import { setDesktopNotifications, useDesktopNotifications } from './useDesktopNotifications';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'Notification',
  'Event',
  'fetch',
  'setInterval',
  'clearInterval',
  'IS_REACT_ACT_ENVIRONMENT',
];
const LATEST_PATH = '/notifications?limit=20&includeSnoozed=true';
// TanStack took the tests for a server when it loaded, before they set a window, and a
// server schedules no refetch interval.
const loadedAsServer = environmentManager.isServer();

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let saved: Map<string, PropertyDescriptor | undefined>;
let items: unknown[];
let rev: number;
let requests: string[];
let shown: FakeNotification[];
let pushed: string[];
let focused: boolean;
let hidden: boolean;
let permission: NotificationPermission;
let intervals: Map<number, () => void>;
// Whether the page under test is an installed app window (display-mode: standalone).
let appWindow: boolean;
// The display-mode query's change events.
let displayMode: EventTarget;
// The Web Locks held in this browser: the page's own, and in some tests one that an app
// window in another browsing context holds.
let heldLocks: { name: string; mode: LockMode }[];

const APP_LOCK = 'desktop-notifications-app';

// Set by a test to hold a granted lock's callback back, as when the grant and the page's
// task that runs the callback are apart.
let beforeCallback: Promise<void> | null;
// How many requests the browser has granted.
let grants: number;

// Like a browser: the lock is granted in a later task, never inside request(), and a
// request aborted before that is rejected and never granted.
const fakeLocks = {
  async request(name: string, options: LockOptions, callback: () => Promise<void>) {
    await new Promise((r) => setTimeout(r, 0));
    if (options.signal?.aborted) throw new dom.window.DOMException('Aborted', 'AbortError');
    const lock = { name, mode: options.mode ?? 'exclusive' };
    heldLocks.push(lock);
    grants += 1;
    try {
      await beforeCallback;
      await callback();
    } finally {
      heldLocks.splice(heldLocks.indexOf(lock), 1);
    }
  },
  async query() {
    return { held: [...heldLocks], pending: [] };
  },
};

class FakeNotification {
  static get permission() {
    return permission;
  }
  static async requestPermission() {
    permission = 'granted';
    return permission;
  }
  onclick: (() => void) | null = null;
  closed = false;
  constructor(
    public title: string,
    public options: NotificationOptions,
  ) {
    shown.push(this);
  }
  close() {
    this.closed = true;
  }
}

function item(id: number) {
  return {
    id,
    type: 'mentioned',
    actorUserId: 'u1',
    actorName: 'Ada',
    readAt: null,
    snoozedUntil: null,
    createdAt: new Date(Date.UTC(2026, 10, 14, 0, id)).toISOString(),
    issueId: 10,
    issueSeq: 7,
    issueTitle: 'Fix login',
    issueStateType: 'started',
    issueCommentId: 5,
    documentId: null,
    documentTitle: null,
    documentIcon: null,
    documentCommentId: null,
    projectId: 3,
    projectKey: 'MKT',
    projectName: 'Marketing',
    fromState: null,
    toState: null,
  };
}

function Probe() {
  useDesktopNotifications();
  return null;
}

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

async function settle() {
  for (let i = 0; i < 10; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

async function render() {
  const router = {
    push: (path: string) => void pushed.push(path),
    replace() {},
    prefetch() {},
    back() {},
    forward() {},
    refresh() {},
  };
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SyncProvider>
          <AppRouterContext.Provider value={router as never}>
            <NextIntlClientProvider locale="en" messages={{ inbox, documents }} timeZone="UTC">
              <Probe />
            </NextIntlClientProvider>
          </AppRouterContext.Provider>
        </SyncProvider>
      </QueryClientProvider>,
    ),
  );
  await settle();
}

// The inbox changes, then the sync poll's interval fires as it does every 8 seconds.
async function inboxMoves(next: unknown[]) {
  items = next;
  rev += 1;
  await act(() => [...intervals.values()].forEach((tick) => tick()));
  await settle();
}

beforeEach(() => {
  saved = new Map(replacedGlobals.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]));
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://web.test/',
    pretendToBeVisual: true,
  });
  items = [item(1)];
  rev = 1;
  requests = [];
  shown = [];
  pushed = [];
  focused = false;
  hidden = false;
  permission = 'granted';
  intervals = new Map();
  appWindow = false;
  displayMode = new dom.window.EventTarget();
  heldLocks = [];
  beforeCallback = null;
  grants = 0;
  dom.window.matchMedia = (media) =>
    Object.assign(displayMode, {
      media,
      matches: media === '(display-mode: standalone)' && appWindow,
      onchange: null,
      addListener() {},
      removeListener() {},
    });
  Object.defineProperty(dom.window.navigator, 'locks', { configurable: true, value: fakeLocks });
  const win = dom.window as unknown as Window & Record<string, unknown>;
  win.Notification = FakeNotification;
  win.focus = () => {};
  dom.window.document.hasFocus = () => focused;
  Object.defineProperty(dom.window.document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
  dom.window.localStorage.setItem('desktopNotifications', 'on');
  setGlobal('window', win);
  setGlobal('document', dom.window.document);
  setGlobal('navigator', dom.window.navigator);
  setGlobal('localStorage', dom.window.localStorage);
  setGlobal('Notification', FakeNotification);
  setGlobal('Event', dom.window.Event);
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let lastInterval = 0;
  setGlobal('setInterval', (tick: () => void) => {
    lastInterval += 1;
    intervals.set(lastInterval, tick);
    return lastInterval;
  });
  setGlobal('clearInterval', (id: number) => intervals.delete(id));
  environmentManager.setIsServer(() => false);
  setGlobal('fetch', async (input: string) => {
    const path = new URL(input).pathname + new URL(input).search;
    requests.push(path);
    if (path.startsWith('/sync/rev')) return json({ revs: { 'inbox:all': String(rev) } });
    if (path === LATEST_PATH) return json({ items, nextCursor: null });
    if (path === '/projects') return json([{ id: 3, key: 'MKT', ref: 'acme.MKT' }]);
    return json({});
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = createRoot(dom.window.document.getElementById('root')!);
});

afterEach(() => {
  act(() => root.unmount());
  client.clear();
  environmentManager.setIsServer(() => loadedAsServer);
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (globalThis as Record<string, unknown>)[name];
  }
});

describe('useDesktopNotifications', () => {
  it('shows nothing for the items that were unread when it came on', async () => {
    await render();
    assert.ok(requests.includes(LATEST_PATH));
    assert.equal(shown.length, 0);
  });

  it('shows a new item while the app is not in front and opens it on click', async () => {
    await render();
    await inboxMoves([item(2), item(1)]);
    assert.equal(shown.length, 1);
    assert.equal(shown[0].title, 'MKT-7 Fix login');
    assert.equal(shown[0].options.body, 'Ada mentioned you');
    assert.equal(shown[0].options.tag, 'inbox-2');
    shown[0].onclick?.();
    assert.deepEqual(pushed, ['/acme/issue/MKT-7#comment-5']);
    assert.equal(shown[0].closed, true);
  });

  it('shows a new item while the page is hidden', async () => {
    hidden = true;
    await render();
    await inboxMoves([item(2), item(1)]);
    assert.deepEqual(
      shown.map((n) => n.options.tag),
      ['inbox-2'],
    );
  });

  it('skips older unread items that move into the newest 20, and shows a newer one', async () => {
    const unread = Array.from({ length: 30 }, (_, i) => item(30 - i));
    items = unread.slice(0, 20);
    await render();
    // The newest 10 are deleted on another device.
    await inboxMoves(unread.slice(10));
    assert.equal(shown.length, 0);
    await inboxMoves([item(31), ...unread.slice(10, 29)]);
    assert.deepEqual(
      shown.map((n) => n.options.tag),
      ['inbox-31'],
    );
  });

  it('shows nothing for the items that came in while it was off', async () => {
    await render();
    await act(() => setDesktopNotifications(false));
    await settle();
    items = [item(2), item(1)];
    await act(() => setDesktopNotifications(true));
    await settle();
    assert.equal(shown.length, 0);
    await inboxMoves([item(3), item(2), item(1)]);
    assert.deepEqual(
      shown.map((n) => n.options.tag),
      ['inbox-3'],
    );
  });

  it('starts from the newest item even when it is read, and skips items read already', async () => {
    const read = (id: number) => ({ ...item(id), readAt: item(id).createdAt });
    items = [read(5)];
    await render();
    await inboxMoves([read(7), item(6), read(5)]);
    assert.deepEqual(
      shown.map((n) => n.options.tag),
      ['inbox-6'],
    );
  });

  it('shows the first item of a member who had none', async () => {
    items = [];
    await render();
    await inboxMoves([item(1)]);
    assert.deepEqual(
      shown.map((n) => n.options.tag),
      ['inbox-1'],
    );
  });

  it('shows nothing while another tab of the app is in front', async () => {
    hidden = true;
    await render();
    dom.window.localStorage.setItem('desktopNotificationsFront', `other ${Date.now()}`);
    await inboxMoves([item(2), item(1)]);
    assert.equal(shown.length, 0);
    // That tab went away without clearing its mark.
    dom.window.localStorage.setItem('desktopNotificationsFront', `other ${Date.now() - 60_000}`);
    await inboxMoves([item(3), item(2), item(1)]);
    assert.deepEqual(
      shown.map((n) => n.options.tag),
      ['inbox-3'],
    );
  });

  it('shows nothing in an ordinary tab while an app window holds the lock', async () => {
    hidden = true;
    heldLocks.push({ name: APP_LOCK, mode: 'shared' });
    await render();
    await inboxMoves([item(2), item(1)]);
    assert.equal(shown.length, 0);
  });

  it('shows in an ordinary tab again once the app window lets the lock go', async () => {
    hidden = true;
    const appLock = { name: APP_LOCK, mode: 'shared' as const };
    heldLocks.push(appLock);
    await render();
    await inboxMoves([item(2), item(1)]);
    // The app window closes, and the browser releases its lock.
    heldLocks.splice(heldLocks.indexOf(appLock), 1);
    await inboxMoves([item(3), item(2), item(1)]);
    assert.deepEqual(
      shown.map((n) => n.options.tag),
      ['inbox-3'],
    );
  });

  it('shows in an app window, which holds the lock', async () => {
    hidden = true;
    appWindow = true;
    await render();
    assert.deepEqual(heldLocks, [{ name: APP_LOCK, mode: 'shared' }]);
    await inboxMoves([item(2), item(1)]);
    assert.deepEqual(
      shown.map((n) => n.options.tag),
      ['inbox-2'],
    );
  });

  it('holds the lock in an app window only while on, until turned off or unmounted', async () => {
    appWindow = true;
    dom.window.localStorage.removeItem('desktopNotifications');
    await render();
    assert.equal(heldLocks.length, 0);
    await act(() => setDesktopNotifications(true));
    await settle();
    assert.equal(heldLocks.length, 1);
    await act(() => setDesktopNotifications(false));
    await settle();
    assert.equal(heldLocks.length, 0);
    await act(() => setDesktopNotifications(true));
    await settle();
    assert.equal(heldLocks.length, 1);
    act(() => root.unmount());
    await settle();
    assert.equal(heldLocks.length, 0);
  });

  it('takes no lock when turned off before the browser grants it', async () => {
    appWindow = true;
    dom.window.localStorage.removeItem('desktopNotifications');
    await render();
    // On and off again in one go: the request is aborted while it waits for the grant.
    await act(async () => {
      await setDesktopNotifications(true);
      await setDesktopNotifications(false);
    });
    await settle();
    assert.equal(grants, 0);
    assert.equal(heldLocks.length, 0);
  });

  it('lets go of a lock whose callback runs after the notifications were turned off', async () => {
    appWindow = true;
    let runCallback!: () => void;
    beforeCallback = new Promise((r) => (runCallback = r));
    await render();
    // Granted, and the callback has not run yet.
    assert.equal(heldLocks.length, 1);
    await act(() => setDesktopNotifications(false));
    runCallback();
    await settle();
    assert.equal(heldLocks.length, 0);
  });

  it('takes the lock when the browser moves the tab into the app window, and lets go when moved back', async () => {
    await render();
    assert.equal(heldLocks.length, 0);
    appWindow = true;
    act(() => void displayMode.dispatchEvent(new dom.window.Event('change')));
    await settle();
    assert.deepEqual(heldLocks, [{ name: APP_LOCK, mode: 'shared' }]);
    appWindow = false;
    act(() => void displayMode.dispatchEvent(new dom.window.Event('change')));
    await settle();
    assert.equal(heldLocks.length, 0);
  });

  for (const inAppWindow of [false, true]) {
    const where = inAppWindow ? 'an app window' : 'an ordinary tab';
    it(`shows in ${where} as before where the browser has no Web Locks`, async () => {
      hidden = true;
      appWindow = inAppWindow;
      delete (dom.window.navigator as unknown as Record<string, unknown>).locks;
      await render();
      await inboxMoves([item(2), item(1)]);
      assert.deepEqual(
        shown.map((n) => n.options.tag),
        ['inbox-2'],
      );
    });
  }

  it('shows nothing while the app is in front', async () => {
    focused = true;
    await render();
    await inboxMoves([item(2), item(1)]);
    assert.equal(shown.length, 0);
  });

  it('reads nothing while it is turned off', async () => {
    dom.window.localStorage.removeItem('desktopNotifications');
    await render();
    assert.ok(!requests.includes(LATEST_PATH));
    assert.ok(!requests.some((p) => p.startsWith('/sync/rev')));
  });
});

describe('setDesktopNotifications', () => {
  it('asks for permission before it turns on, and forgets the choice when turned off', async () => {
    permission = 'default';
    dom.window.localStorage.removeItem('desktopNotifications');
    await setDesktopNotifications(true);
    assert.equal(permission, 'granted');
    assert.equal(dom.window.localStorage.getItem('desktopNotifications'), 'on');
    await setDesktopNotifications(false);
    assert.equal(dom.window.localStorage.getItem('desktopNotifications'), null);
  });
});
