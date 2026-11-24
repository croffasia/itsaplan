import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import * as auth from '@/lib/auth-client';
import type {
  AccountNotificationPreferences,
  AccountNotificationPreferencesPatch,
  NotificationPreferences,
} from '@/lib/api/endpoints/notificationPreferences';
import type { SlackAccount } from '@/lib/api/endpoints/slack';
import type { TelegramAccount } from '@/lib/api/endpoints/telegram';
import account from '../../../../../messages/en/account.json';
import common from '../../../../../messages/en/common.json';

// The page folds the defaults and every team, shows a column only for a connected channel,
// marks only the projects with settings of their own, and saves every change on the spot.

type SessionSnapshot = ReturnType<typeof auth.useSession>;
const { spyOn } = createRequire(import.meta.url)('bun:test') as {
  spyOn(
    target: object,
    method: string,
  ): {
    mockImplementation(implementation: () => SessionSnapshot): { mockRestore(): void };
  };
};

const labels = account.notifications;
const off = {
  assigned: false,
  mentioned: false,
  commented: false,
  state_changed: false,
  reacted: false,
};
const none: NotificationPreferences = {
  emailEvents: off,
  telegramEvents: off,
  slackEvents: off,
  pushEvents: off,
};
const assignedByEmail = { ...none, emailEvents: { ...off, assigned: true } };
const slackTeam = (link: SlackAccount['link']): SlackAccount => ({
  slackTeamId: 'T1',
  slackTeamName: 'Acme',
  available: true,
  link,
});

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;
let originalFetch: typeof fetch;
let restoreSession: () => void;
let stored: AccountNotificationPreferences;
let telegram: TelegramAccount;
let slack: SlackAccount[];
let devices: number;
// Refuses every request for the preferences.
let down: boolean;
// What the api waits for before it answers a write.
let held: Promise<void>;
let patches: AccountNotificationPreferencesPatch[];

const project = (
  id: number,
  name: string,
  preferences: NotificationPreferences | null,
  slackTeamId: string | null = null,
) => ({ id, name, team: { id: 1, name: 'Product' }, slackTeamId, preferences });

function store(patch: AccountNotificationPreferencesPatch) {
  stored = {
    defaults: patch.defaults ?? stored.defaults,
    projects: stored.projects.map((p) => {
      const change = patch.projects?.find((c) => c.projectId === p.id);
      if (change) return { ...p, preferences: change.preferences };
      return patch.resetProjects ? { ...p, preferences: null } : p;
    }),
  };
}

const settle = async () => {
  for (let i = 0; i < 10; i++) await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
};

async function render({ teamOpen = true } = {}) {
  const { default: AccountNotificationsPage } = await import('../../AccountNotificationsPage');
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ account, common }} timeZone="UTC">
          <AccountNotificationsPage />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
  await settle();
  if (teamOpen) await click(team());
}

const text = () => document.body.textContent ?? '';
const button = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('button')].find(
    (el) => (el.getAttribute('aria-label') ?? el.textContent) === name,
  ) ?? null;
const box = (owner: string, event: string, channel: string) =>
  document.querySelector<HTMLButtonElement>(
    `button[role="checkbox"][aria-label="${owner}: ${event}, ${channel}"]`,
  );
const team = () =>
  [...document.querySelectorAll<HTMLElement>('h3 button')].find((el) =>
    el.textContent?.startsWith('Product'),
  ) ?? null;
// The row of a closed project, its mark included.
const row = (name: string) => button(name)!.parentElement!.parentElement!.parentElement!;

// Holds the writes until the returned function is called.
function holdWrites(): () => void {
  let release = () => {};
  held = new Promise((resolve) => {
    release = resolve;
  });
  return release;
}

async function click(el: HTMLElement | null) {
  assert.ok(el);
  await act(async () => el.click());
  await settle();
}

beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'https://planner.test/account/notifications',
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
    Event: dom.window.Event,
    MutationObserver: dom.window.MutationObserver,
    localStorage: dom.window.localStorage,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  stored = {
    defaults: assignedByEmail,
    projects: [
      project(1, 'Billing', null),
      project(2, 'Mobile', { ...none, emailEvents: { ...off, mentioned: true } }),
      project(3, 'Website', none),
    ],
  };
  telegram = { botUsername: null, link: null };
  slack = [];
  devices = 0;
  down = false;
  held = Promise.resolve();
  patches = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const { pathname } = new URL(String(input));
    if (pathname === '/account/notification-preferences') {
      if (init?.method === 'PATCH') await held;
      if (down) return Response.json({ error: 'Down' }, { status: 503 });
      if (init?.method !== 'PATCH') return Response.json(stored);
      const patch = JSON.parse(String(init.body)) as AccountNotificationPreferencesPatch;
      patches.push(patch);
      store(patch);
      return new Response(null, { status: 204 });
    }
    if (pathname === '/telegram/account') return Response.json(telegram);
    if (pathname === '/slack/accounts') return Response.json(slack);
    if (pathname === '/push/config')
      return Response.json({ enabled: devices > 0, publicKey: devices > 0 ? 'key' : null });
    if (pathname === '/push/subscriptions')
      return Response.json(Array.from({ length: devices }, (_, id) => ({ id, endpoint: '' })));
    return Response.json(null);
  }) as typeof fetch;
  const session = spyOn(auth, 'useSession').mockImplementation(
    () => ({ data: { user: { email: 'ann@example.test' } } }) as SessionSnapshot,
  );
  restoreSession = () => session.mockRestore();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(() => root.unmount());
  client.clear();
  restoreSession();
  globalThis.fetch = originalFetch;
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

describe('AccountNotificationsPage', () => {
  it('folds the defaults and the teams, with how many projects a team has', async () => {
    await render({ teamOpen: false });

    assert.equal(box(labels.defaults, labels.events.assigned, labels.email), null);
    assert.equal(team()!.textContent, 'Product3 projects');
    assert.equal(button('Billing'), null);
  });

  it('marks only the projects with settings of their own', async () => {
    await render();

    assert.equal(row('Billing').textContent, 'Billing');
    assert.equal(row('Mobile').textContent, `Mobile${labels.custom}`);
    assert.equal(row('Website').textContent, `Website${labels.off}`);
  });

  it('has a column only for a connected channel', async () => {
    await render();
    await click(button(labels.defaults));

    assert.ok(box(labels.defaults, labels.events.assigned, labels.email));
    for (const channel of [labels.telegram, labels.slack, labels.push])
      assert.equal(box(labels.defaults, labels.events.assigned, channel), null);
  });

  it('keeps Telegram for a connected account while the instance has no bot', async () => {
    telegram.link = { username: 'ann', firstName: null, linkedAt: '2026-11-24T00:00:00.000Z' };
    await render();
    await click(button(labels.defaults));

    assert.ok(box(labels.defaults, labels.events.assigned, labels.telegram));
    assert.ok(button(labels.disconnectChannel.replace('{channel}', labels.telegram)));
  });

  it('has a Push column once push is on in any browser of the user', async () => {
    devices = 1;
    await render();
    await click(button(labels.defaults));

    assert.ok(box(labels.defaults, labels.events.assigned, labels.push));
  });

  it('has a Slack column only in a project that sends to the connected Slack workspace', async () => {
    slack = [slackTeam({ name: 'Ann', linkedAt: '2026-11-24T00:00:00.000Z' })];
    stored.projects = [project(1, 'Billing', null, 'T1'), project(2, 'Mobile', null, 'T2')];
    await render();
    await click(button('Billing'));
    await click(button('Mobile'));

    assert.ok(text().includes('Ann, Acme'));
    assert.ok(box('Billing', labels.events.assigned, labels.slack));
    assert.equal(box('Mobile', labels.events.assigned, labels.slack), null);
  });

  it('offers to connect a Slack workspace, without a column until then', async () => {
    slack = [slackTeam(null)];
    stored.projects = [project(1, 'Billing', null, 'T1')];
    await render();
    await click(button('Billing'));

    assert.ok(text().includes('Not connected to Acme'));
    assert.ok(button(labels.connectChannel.replace('{channel}', labels.slack)));
    assert.equal(box('Billing', labels.events.assigned, labels.slack), null);
  });

  it('gives a project settings of its own from the defaults when a checkbox changes', async () => {
    await render();
    await click(button('Billing'));
    assert.equal(
      box('Billing', labels.events.assigned, labels.email)!.getAttribute('aria-checked'),
      'true',
    );

    await click(box('Billing', labels.events.mentioned, labels.email));

    assert.deepEqual(patches, [
      {
        projects: [
          {
            projectId: 1,
            preferences: { ...none, emailEvents: { ...off, assigned: true, mentioned: true } },
          },
        ],
      },
    ]);
    assert.ok(text().includes(labels.saved));

    await click(button(labels.useDefaultsFor.replace('{project}', 'Billing')));

    assert.deepEqual(patches[1], { projects: [{ projectId: 1, preferences: null }] });
  });

  it('keeps both of two changes made before the first is saved', async () => {
    await render();
    await click(button(labels.defaults));
    const release = holdWrites();

    await click(box(labels.defaults, labels.events.mentioned, labels.email));
    await click(box(labels.defaults, labels.events.reacted, labels.email));
    assert.deepEqual(patches, []);
    release();
    await settle();

    assert.equal(patches.length, 2);
    assert.deepEqual(stored.defaults.emailEvents, {
      ...off,
      assigned: true,
      mentioned: true,
      reacted: true,
    });
  });

  it('takes a refused change back, also while the api answers nothing', async () => {
    await render();
    await click(button('Billing'));
    down = true;

    await click(box('Billing', labels.events.mentioned, labels.email));

    assert.equal(
      box('Billing', labels.events.mentioned, labels.email)!.getAttribute('aria-checked'),
      'false',
    );
  });

  it('applies the defaults to every project only once it is confirmed', async () => {
    await render();
    await click(button(labels.defaults));
    await click(button(labels.applyToAll));

    assert.ok(text().includes('2 projects lose their own settings.'));
    assert.deepEqual(patches, []);

    const release = holdWrites();
    await click(button(labels.applyToAllConfirm));
    assert.ok(text().includes('2 projects lose their own settings.'));
    release();
    await settle();

    assert.deepEqual(patches, [{ resetProjects: true }]);
    assert.equal(button(labels.applyToAll), null);
    assert.equal(row('Mobile').textContent, 'Mobile');
  });

  it('replaces the settings of the selected projects with one set', async () => {
    await render();
    await click(button(labels.selectProjects));
    assert.equal(button(labels.edit), null);
    for (const id of [0, 2])
      await click(document.querySelectorAll<HTMLElement>('label button[role="checkbox"]')[id]!);
    assert.ok(text().includes('2 projects selected'));

    await click(button(labels.edit));
    await click(box('Edit 2 projects', labels.events.reacted, labels.email));
    await click(button(common.save));

    const preferences = { ...none, emailEvents: { ...off, assigned: true, reacted: true } };
    assert.deepEqual(patches, [
      {
        projects: [
          { projectId: 1, preferences },
          { projectId: 3, preferences },
        ],
      },
    ]);
    assert.ok(button(labels.selectProjects));
  });

  it('edits only the channels of the selected projects, and keeps their others', async () => {
    slack = [slackTeam({ name: 'Ann', linkedAt: '2026-11-24T00:00:00.000Z' })];
    const telegramEvents = { ...off, mentioned: true };
    stored.projects = [
      project(1, 'Billing', null, 'T1'),
      project(2, 'Mobile', { ...none, telegramEvents }),
      project(3, 'Website', none),
    ];
    await render();
    await click(button(labels.selectProjects));
    for (const id of [1, 2])
      await click(document.querySelectorAll<HTMLElement>('label button[role="checkbox"]')[id]!);

    await click(button(labels.edit));
    assert.equal(box('Edit 2 projects', labels.events.reacted, labels.slack), null);
    await click(button(common.save));

    assert.deepEqual(patches, [
      {
        projects: [
          { projectId: 2, preferences: { ...assignedByEmail, telegramEvents } },
          { projectId: 3, preferences: assignedByEmail },
        ],
      },
    ]);
  });

  it('keeps the selection and the edit when the save is refused', async () => {
    await render();
    await click(button(labels.selectProjects));
    await click(button(labels.selectTeam.replace('{team}', 'Product')));
    await click(button(labels.edit));
    await click(box('Edit 3 projects', labels.events.reacted, labels.email));
    down = true;

    await click(button(common.save));

    const reacted = box('Edit 3 projects', labels.events.reacted, labels.email);
    assert.equal(reacted!.getAttribute('aria-checked'), 'true');
    assert.ok(text().includes('3 projects selected'));
  });

  it('selects a whole team from its folded row, and clears it again', async () => {
    await render({ teamOpen: false });
    await click(button(labels.selectProjects));
    const all = labels.selectTeam.replace('{team}', 'Product');

    await click(button(all));
    assert.ok(text().includes('3 projects selected'));
    await click(button(all));
    assert.ok(!text().includes('selected'));

    await click(team());
    await click(document.querySelector<HTMLElement>('label button[role="checkbox"]'));
    assert.equal(button(all)!.getAttribute('aria-checked'), 'mixed');
  });

  it('says where projects appear when there are none', async () => {
    stored.projects = [];
    await render({ teamOpen: false });

    assert.ok(text().includes(labels.noProjects));
    assert.equal(button(labels.selectProjects), null);
  });
});
