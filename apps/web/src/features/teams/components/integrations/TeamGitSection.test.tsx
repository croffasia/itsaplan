import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { GitProviderConnection } from '@/lib/api/endpoints/git';
import common from '../../../../../messages/en/common.json';
import settings from '../../../../../messages/en/settings.json';
import teams from '../../../../../messages/en/teams.json';

// The team's hosts list the address only when it is not the public one, name the
// repositories whose webhook failed, disconnect after a confirmation, and connect through
// a dialog that leaves out the address for Bitbucket, and open on the repositories the
// team's projects sync with, the rest of what the token reaches behind a button.

const git = settings.git;

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;
let originalFetch: typeof fetch;
let connections: GitProviderConnection[];
let deleted: string[];

const connection = (
  id: number,
  provider: GitProviderConnection['provider'],
  baseUrl: string,
  failing: { fullName: string; lastError: string }[] = [],
) =>
  ({
    id,
    provider,
    baseUrl,
    accountLogin: 'octo',
    repositories: failing.map((repository, index) => ({ id: index + 1, ...repository })),
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
  }) as GitProviderConnection;

const settle = async () => {
  for (let i = 0; i < 10; i++) await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
};

async function render() {
  const { default: TeamGitSection } = await import('./TeamGitSection');
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ common, settings, teams }} timeZone="UTC">
          <TeamGitSection teamId={7} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
  await settle();
}

const text = () => document.body.textContent ?? '';
const button = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('button')].find(
    (el) => (el.getAttribute('aria-label') ?? el.textContent) === name,
  ) ?? null;

beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'https://planner.test/acme/settings/git',
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
  connections = [];
  deleted = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const { pathname } = new URL(String(input));
    if (init?.method === 'DELETE') {
      deleted.push(pathname);
      return new Response(null, { status: 204 });
    }
    if (pathname === '/teams/7') return Response.json({ id: 7, role: 'owner' });
    if (pathname === '/teams/7/settings/git/connections') return Response.json(connections);
    if (pathname === '/teams/7/settings/git/connections/1/synced-repositories')
      return Response.json([
        {
          externalId: '1',
          fullName: 'acme/site',
          webUrl: 'https://github.com/acme/site',
          projects: [{ id: 3, name: 'Marketing' }],
        },
      ]);
    if (pathname === '/teams/7/settings/git/connections/1/repositories')
      return Response.json({
        repositories: [
          {
            externalId: '1',
            fullName: 'acme/site',
            webUrl: 'https://github.com/acme/site',
            projects: [{ id: 3, name: 'Marketing' }],
          },
          {
            externalId: '2',
            fullName: 'acme/docs',
            webUrl: 'https://github.com/acme/docs',
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

describe('TeamGitSection', () => {
  it('names the address only when it is not the public one, and the failing webhooks', async () => {
    connections = [
      connection(1, 'github', 'https://github.com'),
      connection(2, 'gitea', 'http://git.acme.test', [
        { fullName: 'acme/billing', lastError: 'The webhook returned 404.' },
      ]),
    ];
    await render();

    assert.ok(text().includes('GitHubocto'));
    assert.equal(text().includes('github.com'), false);
    assert.ok(text().includes('octo · git.acme.test'));
    assert.ok(text().includes('acme/billing: The webhook returned 404.'));
  });

  it('opens a host on its synced repositories, and the rest behind a button', async () => {
    connections = [connection(1, 'github', 'https://github.com')];
    await render();
    assert.equal(text().includes('acme/site'), false);

    const fold = document.querySelector<HTMLElement>('button[aria-expanded]')!;
    await act(async () => fold.click());
    await settle();

    assert.equal(fold.getAttribute('aria-expanded'), 'true');
    assert.ok(text().includes('acme/siteMarketing'));
    assert.equal(text().includes('acme/docs'), false);
    await act(async () => button(git.allRepositories)!.click());
    await settle();
    assert.ok(text().includes(git.allRepositoriesTeamHint));
    assert.ok(text().includes('acme/docs'));
  });

  it('shows the empty state while no host is connected', async () => {
    await render();

    assert.ok(text().includes(git.nativeEmpty));
  });

  it('disconnects a host only after the user confirms', async () => {
    connections = [connection(5, 'gitlab', 'https://gitlab.com')];
    await render();
    await act(async () =>
      button(git.nativeDisconnectProvider.replace('{provider}', 'GitLab'))!.click(),
    );
    await settle();

    assert.ok(text().includes(git.nativeDisconnectWarning));
    assert.deepEqual(deleted, []);
    const confirm = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find(
      (el) => el.textContent === git.nativeDisconnect,
    );
    await act(async () => confirm!.click());
    await settle();
    assert.deepEqual(deleted, ['/teams/7/settings/git/connections/5']);
  });

  it('leaves out the address and the token link for Bitbucket', async () => {
    await render();
    await act(async () => button(git.nativeConnectHostTitle)!.click());
    await settle();
    const link = () =>
      [...document.querySelectorAll('a')].find((a) => a.textContent === git.accountCreateToken);

    assert.equal(link()!.href, 'https://github.com/settings/personal-access-tokens/new');
    await act(async () => button('Bitbucket')!.click());
    assert.equal(document.getElementById('git-provider-url'), null);
    assert.equal(link(), undefined);
  });
});
