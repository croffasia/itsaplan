import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import account from '../../../../../messages/en/account.json';

// The switch turns push on for this browser: the permission prompt opens on the tap,
// then the service worker is registered, the browser subscribes with the instance key
// and the api stores the subscription. Off reverses it. The row is hidden while the
// instance sends no push, and says why where the browser cannot receive it. While push is
// on, a flag in localStorage stands the desktop notifications down.

const labels = account.preferences;
const PUBLIC_KEY =
  'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
const OTHER_KEY =
  'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;
let originalFetch: typeof fetch;
let calls: { method: string; path: string; body?: unknown }[];
let config: { enabled: boolean; publicKey: string | null };
let stored: string[];
let permission: NotificationPermission;
let answer: NotificationPermission;
let prompts: number;
let registered: string[];
let subscription: FakeSubscription | null;
let subscribed: PushSubscriptionOptionsInit[];
let unsubscribed: string[];
let issued: number;
let apiDown: boolean;

class FakeSubscription {
  readonly options: { applicationServerKey: ArrayBuffer };
  constructor(
    readonly endpoint: string,
    key = PUBLIC_KEY,
  ) {
    this.options = { applicationServerKey: new Uint8Array(Buffer.from(key, 'base64url')).buffer };
  }
  toJSON() {
    return {
      endpoint: this.endpoint,
      keys: { p256dh: PUBLIC_KEY, auth: 'BTBZMqHH6r4Tts7J_aSIgg' },
    };
  }
  async unsubscribe() {
    unsubscribed.push(this.endpoint);
    if (subscription === this) subscription = null;
    return true;
  }
}

const registration = {
  pushManager: {
    getSubscription: async () => subscription,
    subscribe: async (options: PushSubscriptionOptionsInit) => {
      subscribed.push(options);
      issued += 1;
      subscription = new FakeSubscription(`https://push.example.test/${issued}`);
      return subscription;
    },
  },
};

class FakeNotification {
  static get permission() {
    return permission;
  }
  static async requestPermission() {
    prompts += 1;
    permission = answer;
    return permission;
  }
}

// A browser with the Push API: a service worker container, PushManager and Notification.
function pushCapable(win: JSDOM['window']) {
  Object.defineProperty(win.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: async (url: string) => {
        registered.push(url);
        return registration;
      },
      get ready() {
        return Promise.resolve(registration);
      },
      getRegistration: async () => (registered.length > 0 ? registration : undefined),
    },
  });
  Object.assign(win, { PushManager: class {}, Notification: FakeNotification });
}

const settle = async () => {
  for (let i = 0; i < 10; i++) await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
};

async function render({ withDesktopRow = false } = {}) {
  const { default: AccountPushNotifications } = await import('./AccountPushNotifications');
  const { default: AccountDesktopNotifications } = await import('./AccountDesktopNotifications');
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ account }} timeZone="UTC">
          {withDesktopRow && <AccountDesktopNotifications />}
          <AccountPushNotifications />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
  await settle();
}

// The push row is the last one rendered.
const theSwitch = () =>
  [...document.querySelectorAll<HTMLButtonElement>('button[role="switch"]')].at(-1) ?? null;
const pushFlag = () => dom.window.localStorage.getItem('pushNotifications');
const text = () => document.body.textContent ?? '';
const writes = () => calls.filter((call) => call.method !== 'GET');

async function tap() {
  await act(async () => theSwitch()!.click());
  await settle();
}

beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'https://planner.test/account/preferences',
    pretendToBeVisual: true,
  });
  dom.window.__ITSAPLAN_ENV__ = { apiUrl: 'http://api.test', privacyUrl: '', termsUrl: '' };
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLFormElement: dom.window.HTMLFormElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    CustomEvent: dom.window.CustomEvent,
    MutationObserver: dom.window.MutationObserver,
    localStorage: dom.window.localStorage,
    Event: dom.window.Event,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  originals = new Map(
    [...Object.keys(globals), 'Notification'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: FakeNotification,
  });
  config = { enabled: true, publicKey: PUBLIC_KEY };
  stored = [];
  permission = 'default';
  answer = 'granted';
  prompts = 0;
  registered = [];
  subscription = null;
  subscribed = [];
  unsubscribed = [];
  issued = 0;
  apiDown = false;
  calls = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, body });
    if (url.pathname === '/push/config') return Response.json(config);
    if (apiDown && method !== 'GET') return Response.json({ error: 'Down' }, { status: 503 });
    if (method === 'POST') stored.push(body.endpoint);
    if (method === 'DELETE') stored = stored.filter((endpoint) => endpoint !== body.endpoint);
    if (method === 'DELETE') return new Response(null, { status: 204 });
    const devices = stored.map((endpoint, i) => ({
      id: i + 1,
      endpoint,
      createdAt: '2026-11-14T00:00:00.000Z',
    }));
    return Response.json(method === 'POST' ? devices.at(-1) : devices);
  }) as typeof fetch;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(() => root.unmount());
  client.clear();
  globalThis.fetch = originalFetch;
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

describe('AccountPushNotifications', () => {
  it('is hidden while the instance sends no push', async () => {
    config = { enabled: false, publicKey: null };
    pushCapable(dom.window);

    await render();

    assert.equal(text(), '');
    assert.ok(!calls.some((call) => call.path === '/push/subscriptions'));
  });

  it('says so where the browser has no Push API', async () => {
    await render();

    assert.ok(text().includes(labels.pushNotificationsUnsupported));
    assert.ok(text().includes(labels.pushNotificationsOff));
    assert.equal(theSwitch(), null);
  });

  it('sends an iPhone in Safari to the Home Screen first', async () => {
    Object.defineProperty(dom.window.navigator, 'userAgent', { configurable: true, value: IPHONE });

    await render();

    assert.ok(text().includes(labels.pushNotificationsUnsupportedIos));
    assert.equal(theSwitch(), null);
  });

  it('shows a browser that blocks notifications as off, without a switch', async () => {
    pushCapable(dom.window);
    permission = 'denied';

    await render();

    assert.ok(text().includes(labels.pushNotificationsBlocked));
    assert.equal(theSwitch(), null);
  });

  it('turns push on from the tap: permission, service worker, subscription, api', async () => {
    pushCapable(dom.window);
    await render();
    assert.ok(text().includes(labels.pushNotificationsDescription));
    assert.equal(theSwitch()!.getAttribute('aria-checked'), 'false');

    await tap();

    assert.equal(prompts, 1);
    assert.deepEqual(registered, ['/sw.js']);
    assert.equal(subscribed.length, 1);
    assert.equal(subscribed[0]!.userVisibleOnly, true);
    const key = subscribed[0]!.applicationServerKey as Uint8Array;
    assert.equal(Buffer.from(key).toString('base64url'), PUBLIC_KEY);
    assert.deepEqual(writes(), [
      {
        method: 'POST',
        path: '/push/subscriptions',
        body: {
          endpoint: 'https://push.example.test/1',
          keys: { p256dh: PUBLIC_KEY, auth: 'BTBZMqHH6r4Tts7J_aSIgg' },
        },
      },
    ]);
    assert.equal(theSwitch()!.getAttribute('aria-checked'), 'true');
    assert.equal(pushFlag(), 'on');
  });

  it('replaces a subscription this account does not hold before it subscribes', async () => {
    pushCapable(dom.window);
    registered = ['/sw.js'];
    subscription = new FakeSubscription('https://push.example.test/left-behind');
    permission = 'granted';
    await render();
    assert.equal(theSwitch()!.getAttribute('aria-checked'), 'false');

    await tap();

    assert.deepEqual(unsubscribed, ['https://push.example.test/left-behind']);
    assert.deepEqual(stored, ['https://push.example.test/1']);
    assert.equal(theSwitch()!.getAttribute('aria-checked'), 'true');
  });

  it('leaves push off when the permission is refused', async () => {
    pushCapable(dom.window);
    answer = 'denied';
    await render();

    await tap();

    assert.equal(prompts, 1);
    assert.deepEqual(registered, []);
    assert.deepEqual(writes(), []);
    assert.ok(text().includes(labels.pushNotificationsBlocked));
  });

  it('shows push off for a subscription made with keys the instance no longer has', async () => {
    pushCapable(dom.window);
    registered = ['/sw.js'];
    subscription = new FakeSubscription('https://push.example.test/old-keys', OTHER_KEY);
    stored = ['https://push.example.test/old-keys'];
    permission = 'granted';
    await render();
    assert.equal(theSwitch()!.getAttribute('aria-checked'), 'false');

    await tap();

    assert.deepEqual(unsubscribed, ['https://push.example.test/old-keys']);
    assert.equal(theSwitch()!.getAttribute('aria-checked'), 'true');
  });

  it('turns push off: the browser drops the subscription and the api forgets it', async () => {
    pushCapable(dom.window);
    registered = ['/sw.js'];
    subscription = new FakeSubscription('https://push.example.test/kept');
    stored = ['https://push.example.test/kept'];
    permission = 'granted';
    await render();
    assert.equal(theSwitch()!.getAttribute('aria-checked'), 'true');
    // Set from the real subscription when the page loads.
    assert.equal(pushFlag(), 'on');

    await tap();

    assert.deepEqual(writes(), [
      {
        method: 'DELETE',
        path: '/push/subscriptions',
        body: { endpoint: 'https://push.example.test/kept' },
      },
    ]);
    assert.deepEqual(unsubscribed, ['https://push.example.test/kept']);
    assert.equal(theSwitch()!.getAttribute('aria-checked'), 'false');
    assert.equal(pushFlag(), null);
  });

  it('drops the browser subscription even when the api cannot forget it', async () => {
    pushCapable(dom.window);
    registered = ['/sw.js'];
    subscription = new FakeSubscription('https://push.example.test/kept');
    stored = ['https://push.example.test/kept'];
    permission = 'granted';
    apiDown = true;
    await render();

    await tap();

    assert.deepEqual(unsubscribed, ['https://push.example.test/kept']);
    assert.equal(theSwitch()!.getAttribute('aria-checked'), 'false');
  });

  it('clears a flag left behind by a subscription this browser no longer has', async () => {
    pushCapable(dom.window);
    permission = 'granted';
    dom.window.localStorage.setItem('pushNotifications', 'on');

    await render();

    assert.equal(theSwitch()!.getAttribute('aria-checked'), 'false');
    assert.equal(pushFlag(), null);
  });

  it('stands the desktop notifications down once push is on, and brings them back after', async () => {
    pushCapable(dom.window);
    await render({ withDesktopRow: true });
    assert.equal(document.querySelectorAll('button[role="switch"]').length, 2);
    assert.ok(!text().includes(labels.desktopNotificationsReplacedByPush));

    await tap();

    assert.ok(text().includes(labels.desktopNotificationsReplacedByPush));
    assert.equal(document.querySelectorAll('button[role="switch"]').length, 1);

    await tap();

    assert.ok(!text().includes(labels.desktopNotificationsReplacedByPush));
    assert.equal(document.querySelectorAll('button[role="switch"]').length, 2);
  });
});
