import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { GitAccount } from '@/lib/api/endpoints/gitAccounts';
import type { SlackAccount } from '@/lib/api/endpoints/slack';
import type { TelegramAccount } from '@/lib/api/endpoints/telegram';
import account from '../../../../../messages/en/account.json';
import common from '../../../../../messages/en/common.json';
import settings from '../../../../../messages/en/settings.json';

// The page lists the repository accounts with the host only when it is not the public one,
// shows the messengers only while the instance offers one, and connects Telegram in a dialog.

const labels = account.accounts;
const notifications = account.notifications;
const git = settings.git;

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;
let originalFetch: typeof fetch;
let telegram: TelegramAccount;
let slack: SlackAccount[];
let repos: GitAccount[];
let deleted: string[];

const repo = (id: number, provider: GitAccount['provider'], baseUrl: string): GitAccount => ({
  id,
  provider,
  baseUrl,
  accountLogin: 'ann',
  createdAt: '2026-11-24T00:00:00.000Z',
});

const settle = async () => {
  for (let i = 0; i < 10; i++) await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
};

async function render() {
  const { default: AccountAccountsPage } = await import('../../AccountAccountsPage');
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ account, common, settings }} timeZone="UTC">
          <AccountAccountsPage />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
  await settle();
}

const text = () => document.body.textContent ?? '';
const heading = (name: string) =>
  [...document.querySelectorAll('h2')].find((el) => el.textContent === name) ?? null;
const button = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('button')].find(
    (el) => (el.getAttribute('aria-label') ?? el.textContent) === name,
  ) ?? null;

beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'https://planner.test/account/accounts',
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
  telegram = { botUsername: null, link: null };
  slack = [];
  repos = [];
  deleted = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const { pathname } = new URL(String(input));
    if (init?.method === 'DELETE') {
      deleted.push(pathname);
      return new Response(null, { status: 204 });
    }
    if (pathname === '/telegram/account') return Response.json(telegram);
    if (pathname === '/slack/accounts') return Response.json(slack);
    if (pathname === '/account/git-accounts') return Response.json(repos);
    if (pathname === '/account/git-accounts/1/synced-repositories') return Response.json([]);
    if (pathname === '/account/git-accounts/1/repositories')
      return Response.json({
        repositories: [
          {
            externalId: '9',
            fullName: 'ann/notes',
            webUrl: 'https://github.com/ann/notes',
            projects: [],
          },
        ],
        nextPage: null,
      });
    return Response.json(null);
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

describe('AccountAccountsPage', () => {
  it('names the host of a repository account only when it is not the public one', async () => {
    repos = [repo(1, 'github', 'https://github.com'), repo(2, 'gitea', 'https://git.acme.test')];
    await render();

    assert.ok(text().includes('GitHubann'));
    assert.equal(text().includes('github.com'), false);
    assert.ok(text().includes('Giteaann · git.acme.test'));
  });

  it('opens a repository account on its synced repositories, the rest behind a button', async () => {
    repos = [repo(1, 'github', 'https://github.com')];
    await render();

    await act(async () => document.querySelector<HTMLElement>('button[aria-expanded]')!.click());
    await settle();

    assert.ok(text().includes(git.syncedRepositoriesEmpty));
    assert.equal(text().includes('ann/notes'), false);
    await act(async () => button(git.allRepositories)!.click());
    await settle();
    assert.ok(text().includes('ann/notes'));
  });

  it('links to the host page that creates a token, once the address is known', async () => {
    await render();
    await act(async () => button(git.accountConnectTitle)!.click());
    await settle();
    const link = () =>
      [...document.querySelectorAll('a')].find((a) => a.textContent === git.accountCreateToken);

    assert.equal(button('GitHub')!.getAttribute('aria-pressed'), 'true');
    assert.equal(link()!.href, 'https://github.com/settings/personal-access-tokens/new');
    await act(async () => button('Gitea')!.click());
    assert.equal(link(), undefined);
  });

  it('disconnects a repository account only after the user confirms', async () => {
    repos = [repo(1, 'github', 'https://github.com')];
    await render();
    await act(async () =>
      button(notifications.disconnectChannel.replace('{channel}', 'GitHub'))!.click(),
    );
    await settle();

    assert.ok(text().includes(labels.disconnectTitle.replace('{service}', 'GitHub')));
    assert.deepEqual(deleted, []);
    const confirm = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find(
      (el) => el.textContent === labels.disconnect,
    );
    await act(async () => confirm!.click());
    await settle();
    assert.deepEqual(deleted, ['/account/git-accounts/1']);
  });

  it('leaves out the messengers while the instance offers neither', async () => {
    await render();

    assert.ok(heading(labels.repositories));
    assert.equal(heading(labels.messengers), null);
  });

  it('connects Telegram in a dialog', async () => {
    telegram = { botUsername: 'acme_bot', link: null };
    await render();

    assert.ok(heading(labels.messengers));
    await act(async () =>
      button(notifications.connectChannel.replace('{channel}', notifications.telegram))!.click(),
    );
    await settle();
    assert.ok(text().includes(notifications.telegramConnectHint));
    assert.ok(button(notifications.telegramOpen));
  });
});
