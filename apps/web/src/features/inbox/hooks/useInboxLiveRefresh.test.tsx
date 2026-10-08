import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import { SyncProvider } from '@/context/syncContext';
import { useInboxLiveRefresh } from '@/hooks/useInboxLiveRefresh';
import { useInboxUnread } from '@/hooks/useInboxUnread';
import { qk } from '@/services/queryKeys';
import { useNotificationsQuery } from '../services/notifications.service';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;
let dom: JSDOM;
let root: Root;
let client: QueryClient;
let requests: URL[];
let originalDescriptors: Map<string, PropertyDescriptor | undefined>;

function InboxReader({ projectId }: { projectId: number | null }) {
  const key = projectId == null ? 'all' : 'acme.MKT';
  useNotificationsQuery(key, projectId, {});
  useInboxUnread(key, projectId);
  useInboxLiveRefresh(projectId, [['notifications', key]]);
  return null;
}

async function settle() {
  await act(async () => {
    for (let tick = 0; tick < 4; tick++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function render(projectId: number | null) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SyncProvider>
          <InboxReader projectId={projectId} />
        </SyncProvider>
      </QueryClientProvider>,
    ),
  );
  await settle();
}

function latestScopes() {
  return requests.findLast((url) => url.pathname === '/sync/rev')?.searchParams.get('scopes');
}

function readCount(path: string) {
  return requests.filter((url) => url.pathname === path).length;
}

beforeEach(async () => {
  originalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/acme/MKT/inbox',
  });
  requests = [];
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
    fetch: {
      configurable: true,
      value: async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        requests.push(url);
        if (url.pathname === '/sync/rev') {
          const scopes = url.searchParams.get('scopes')!.split(',');
          return Response.json({ revs: Object.fromEntries(scopes.map((scope) => [scope, '0'])) });
        }
        if (url.pathname === '/notifications')
          return Response.json({ items: [], nextCursor: null });
        if (url.pathname === '/notifications/unread') return Response.json({ unread: 0 });
        throw new Error(`Unexpected request: ${url}`);
      },
    },
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  client.setQueryData(qk.projects, [{ id: 1 }, { id: 2 }]);
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  act(() => root.unmount());
  client.clear();
  await settle();
  dom.window.close();
  for (const [name, descriptor] of originalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('Inbox live refresh', () => {
  it('refreshes the global list and badge when another project changes', async () => {
    await render(null);
    assert.equal(latestScopes(), 'inbox:1,inbox:2');
    const lists = readCount('/notifications');
    const badges = readCount('/notifications/unread');

    act(() => {
      client.setQueryData(['sync', 'rev', ['inbox:1', 'inbox:2']], {
        revs: { 'inbox:1': '0', 'inbox:2': '1' },
      });
    });
    await settle();

    assert.equal(readCount('/notifications'), lists + 1);
    assert.equal(readCount('/notifications/unread'), badges + 1);
    assert.equal(
      requests.findLast((url) => url.pathname === '/notifications')!.searchParams.has('projectId'),
      false,
    );
  });

  it('removes global scopes when returning to the project Inbox', async () => {
    await render(null);
    await render(1);
    assert.equal(latestScopes(), 'inbox:1');
    const lists = readCount('/notifications');
    const badges = readCount('/notifications/unread');

    act(() => {
      client.setQueryData(['sync', 'rev', ['inbox:1']], {
        revs: { 'inbox:1': '0', 'inbox:2': '1' },
      });
    });
    await settle();
    assert.equal(readCount('/notifications'), lists);
    assert.equal(readCount('/notifications/unread'), badges);

    act(() => {
      client.setQueryData(['sync', 'rev', ['inbox:1']], { revs: { 'inbox:1': '1' } });
    });
    await settle();
    assert.equal(readCount('/notifications'), lists + 1);
    assert.equal(readCount('/notifications/unread'), badges + 1);
  });

  it('updates project subscriptions and releases every observer on unmount', async () => {
    await render(null);
    act(() => client.setQueryData(qk.projects, [{ id: 2 }, { id: 3 }]));
    await settle();
    assert.equal(latestScopes(), 'inbox:2,inbox:3');

    act(() => root.render(null));
    assert.equal(
      client
        .getQueryCache()
        .findAll({ queryKey: ['sync', 'rev'] })
        .some((query) => query.getObserversCount() > 0),
      false,
    );
  });
});
