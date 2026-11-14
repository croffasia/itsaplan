import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  'IS_REACT_ACT_ENVIRONMENT',
];
const LATEST_PATH = '/notifications?includeRead=false&limit=20';

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
let permission: NotificationPermission;

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
    createdAt: '2026-11-14T00:00:00.000Z',
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

async function inboxMoves(next: unknown[]) {
  items = next;
  rev += 1;
  await act(() => client.invalidateQueries({ queryKey: ['sync', 'rev'] }));
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
  permission = 'granted';
  const win = dom.window as unknown as Window & Record<string, unknown>;
  win.Notification = FakeNotification;
  win.focus = () => {};
  dom.window.document.hasFocus = () => focused;
  dom.window.localStorage.setItem('desktopNotifications', 'on');
  setGlobal('window', win);
  setGlobal('document', dom.window.document);
  setGlobal('navigator', dom.window.navigator);
  setGlobal('localStorage', dom.window.localStorage);
  setGlobal('Notification', FakeNotification);
  setGlobal('Event', dom.window.Event);
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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
