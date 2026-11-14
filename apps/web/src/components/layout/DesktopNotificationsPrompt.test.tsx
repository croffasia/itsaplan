import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import { canShowFromPage, setDesktopNotifications } from '@/hooks/useDesktopNotifications';
import { setPushOnInThisBrowser } from '@/utils/browserNotifications';
import shell from '../../../messages/en/shell.json';
import DesktopNotificationsPrompt from './DesktopNotificationsPrompt';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'Notification',
  'Event',
  'IS_REACT_ACT_ENVIRONMENT',
];
const { message, turnOn, notNow } = shell.desktopNotifications;

let dom: JSDOM;
let root: Root;
let saved: Map<string, PropertyDescriptor | undefined>;
let permission: NotificationPermission;
// What the browser's permission request ends with. 'default' is a request the browser
// leaves undecided: Edge's quiet request, or a prompt the member closes.
let decision: NotificationPermission;
let permissionRequests: number;
// A browser that shows a notification only from a service worker (Chrome on Android):
// its Notification constructor throws a TypeError.
let serviceWorkerOnly: boolean;
let constructed: number;

class FakeNotification {
  static get permission() {
    return permission;
  }
  static async requestPermission() {
    permissionRequests += 1;
    permission = decision;
    return permission;
  }
  constructor() {
    constructed += 1;
    if (serviceWorkerOnly) throw new TypeError('Illegal constructor');
  }
  close() {}
}

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

function render() {
  root = createRoot(dom.window.document.getElementById('root')!);
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ shell }} timeZone="UTC">
        <DesktopNotificationsPrompt />
      </NextIntlClientProvider>,
    ),
  );
}

function reload() {
  act(() => root.unmount());
  render();
}

function shown() {
  return dom.window.document.body.textContent?.includes(message) ?? false;
}

function answered() {
  return dom.window.localStorage.getItem('desktopNotificationsAnswered') != null;
}

// Whether the strip is in the page at any moment while `run` renders.
function shownAtAnyPoint(run: () => void) {
  const records: MutationRecord[] = [];
  const observer = new dom.window.MutationObserver((r) => records.push(...r));
  observer.observe(dom.window.document.body, { childList: true, subtree: true });
  run();
  records.push(...observer.takeRecords());
  observer.disconnect();
  return records.some((r) => [...r.addedNodes].some((n) => n.textContent?.includes(message)));
}

function button(label: string) {
  const found = [...dom.window.document.querySelectorAll('button')].find(
    (b) => b.textContent === label,
  );
  assert.ok(found, label);
  return found;
}

async function settle() {
  for (let i = 0; i < 5; i++) await act(() => new Promise((r) => setTimeout(r, 0)));
}

beforeEach(() => {
  saved = new Map(replacedGlobals.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]));
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://web.test/' });
  permission = 'default';
  decision = 'granted';
  permissionRequests = 0;
  serviceWorkerOnly = false;
  constructed = 0;
  (dom.window as unknown as Record<string, unknown>).Notification = FakeNotification;
  setGlobal('window', dom.window);
  setGlobal('document', dom.window.document);
  setGlobal('navigator', dom.window.navigator);
  setGlobal('localStorage', dom.window.localStorage);
  setGlobal('Notification', FakeNotification);
  setGlobal('Event', dom.window.Event);
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});

afterEach(() => {
  act(() => root.unmount());
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (globalThis as Record<string, unknown>)[name];
  }
});

describe('DesktopNotificationsPrompt', () => {
  it('shows while notifications are off and this browser has not answered', () => {
    render();
    assert.ok(shown());
  });

  it('stays hidden, also on the first render, where only a service worker can show one', () => {
    serviceWorkerOnly = true;
    assert.equal(shownAtAnyPoint(render), false);
  });

  it('constructs no notification to probe once the permission is granted', () => {
    permission = 'granted';
    render();
    assert.ok(shown());
    assert.equal(constructed, 0);
  });

  it('stays hidden on Android once the permission is granted, without constructing one', () => {
    permission = 'granted';
    serviceWorkerOnly = true;
    Object.defineProperty(dom.window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/154.0 Mobile',
    });
    render();
    assert.equal(shown(), false);
    assert.equal(constructed, 0);
  });

  it('reports that no page can show one on the server, where there is no window', () => {
    render();
    setGlobal('window', undefined);
    assert.equal(canShowFromPage(), false);
    setGlobal('window', dom.window);
  });

  const throwing = () => {
    throw new Error('SecurityError');
  };
  const hiddenWhen: [string, () => void][] = [
    [
      'notifications are on',
      () => {
        permission = 'granted';
        dom.window.localStorage.setItem('desktopNotifications', 'on');
      },
    ],
    ['the browser blocks notifications', () => (permission = 'denied')],
    [
      'the browser has no Notifications API',
      () => delete (dom.window as unknown as Record<string, unknown>).Notification,
    ],
    [
      'this browser has answered before',
      () => dom.window.localStorage.setItem('desktopNotificationsAnswered', 'yes'),
    ],
    [
      'the browser storage throws, so an answer could not be kept',
      () =>
        setGlobal('localStorage', { getItem: throwing, setItem: throwing, removeItem: throwing }),
    ],
  ];
  for (const [when, arrange] of hiddenWhen) {
    it(`stays hidden when ${when}`, () => {
      arrange();
      render();
      assert.equal(shown(), false);
    });
  }

  it('turns notifications on when the browser grants them, and hides for good', async () => {
    render();
    act(() => button(turnOn).click());
    // Asked inside the click: browsers ask for the permission only on a user gesture.
    assert.equal(permissionRequests, 1);
    await settle();
    assert.equal(dom.window.localStorage.getItem('desktopNotifications'), 'on');
    assert.equal(shown(), false);
    assert.ok(answered());
  });

  it('hides when the browser denies them, since notifications are then blocked', async () => {
    decision = 'denied';
    render();
    act(() => button(turnOn).click());
    await settle();
    assert.equal(shown(), false);
    assert.ok(answered());
    // Blocked alone keeps it hidden.
    dom.window.localStorage.removeItem('desktopNotificationsAnswered');
    reload();
    assert.equal(shown(), false);
  });

  it('stays, and records nothing, while the browser leaves the request undecided', async () => {
    decision = 'default';
    render();
    act(() => button(turnOn).click());
    await settle();
    assert.ok(shown());
    assert.equal(answered(), false);
    assert.equal(dom.window.localStorage.getItem('desktopNotifications'), null);
    // The member can try again.
    act(() => button(turnOn).click());
    assert.equal(permissionRequests, 2);
  });

  it('hides on "Not now" and stays hidden after a reload', () => {
    render();
    act(() => button(notNow).click());
    assert.equal(shown(), false);
    reload();
    assert.equal(shown(), false);
    assert.equal(permissionRequests, 0);
    assert.equal(dom.window.localStorage.getItem('desktopNotifications'), null);
  });

  it('hides on "Not now" even when the storage refuses to keep the answer', () => {
    const storage = dom.window.localStorage;
    setGlobal('localStorage', {
      getItem: (key: string) => storage.getItem(key),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: (key: string) => storage.removeItem(key),
    });
    render();
    act(() => button(notNow).click());
    assert.equal(shown(), false);
  });

  it('stays hidden for good once the Account switch turned notifications off', async () => {
    await setDesktopNotifications(false);
    render();
    assert.equal(shown(), false);
  });

  it('stays hidden for good once push was turned on in this browser', () => {
    setPushOnInThisBrowser(true);
    setPushOnInThisBrowser(false);
    render();
    assert.equal(shown(), false);
  });

  it('hides when another tab answers', () => {
    render();
    assert.ok(shown());
    dom.window.localStorage.setItem('desktopNotificationsAnswered', 'yes');
    act(() => {
      dom.window.dispatchEvent(
        new dom.window.StorageEvent('storage', { key: 'desktopNotificationsAnswered' }),
      );
    });
    assert.equal(shown(), false);
  });
});
