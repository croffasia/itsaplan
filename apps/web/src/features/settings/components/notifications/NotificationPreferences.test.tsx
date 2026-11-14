import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { NotificationEventToggles } from '@/lib/api/endpoints/notificationSettings';
import { qk } from '@/services/queryKeys';
import type { NotificationPreferencesForm } from '../../hooks/useNotificationPreferencesForm';
import account from '../../../../../messages/en/account.json';
import settings from '../../../../../messages/en/settings.json';

// Push is a column next to Email and Telegram only while the instance sends push.

const labels = settings.notifications;
const none: NotificationEventToggles = {
  assigned: false,
  mentioned: false,
  commented: false,
  state_changed: false,
};

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;
let pushEvents: NotificationEventToggles;

function form(): NotificationPreferencesForm {
  return {
    emailEvents: none,
    setEmailEvents: () => {},
    telegramEvents: none,
    setTelegramEvents: () => {},
    pushEvents,
    setPushEvents: (events) => (pushEvents = events),
    dirty: false,
    saving: false,
    save: async () => {},
  };
}

async function render(pushEnabled: boolean) {
  client.setQueryData(qk.pushConfig, { enabled: pushEnabled, publicKey: pushEnabled ? 'k' : null });
  const { default: NotificationPreferences } = await import('./NotificationPreferences');
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ account, settings }} timeZone="UTC">
          <NotificationPreferences form={form()} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

const box = (label: string) =>
  document.querySelector<HTMLButtonElement>(`button[role="checkbox"][aria-label="${label}"]`);

beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'https://planner.test/acme/MKT/notifications',
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
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  pushEvents = none;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  // No instance bot: the Telegram account section stays out of the way.
  client.setQueryData(qk.telegramAccount, { botUsername: null, link: null });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(() => root.unmount());
  client.clear();
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

describe('NotificationPreferences', () => {
  it('shows a Push column while the instance sends push, and ticks its events', async () => {
    await render(true);

    assert.ok(document.body.textContent?.includes(labels.push));
    const assigned = box(`${labels.events.assigned} — ${labels.push}`);
    assert.ok(assigned);
    await act(async () => assigned.click());
    assert.deepEqual(pushEvents, { ...none, assigned: true });
  });

  it('has no Push column while the instance sends no push', async () => {
    await render(false);

    assert.ok(box(`${labels.events.assigned} — ${labels.email}`));
    assert.equal(box(`${labels.events.assigned} — ${labels.push}`), null);
    assert.ok(!document.body.textContent?.includes(labels.push));
  });
});
