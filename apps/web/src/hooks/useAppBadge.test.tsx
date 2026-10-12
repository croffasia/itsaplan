import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SyncProvider } from '@/context/syncContext';
import { useAppBadge } from './useAppBadge';

const replacedGlobals = ['window', 'document', 'navigator', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'];

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let saved: Map<string, PropertyDescriptor | undefined>;
let unread: number;
let rev: number;
let badge: (number | 'cleared')[];
let requests: string[];

function Probe({ projectIds }: { projectIds: number[] }) {
  useAppBadge(projectIds);
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

async function render(projectIds: number[]) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SyncProvider>
          <Probe projectIds={projectIds} />
        </SyncProvider>
      </QueryClientProvider>,
    ),
  );
  await settle();
}

beforeEach(() => {
  saved = new Map(replacedGlobals.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]));
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://web.test/' });
  unread = 2;
  rev = 1;
  badge = [];
  requests = [];
  const nav = dom.window.navigator as Navigator & Record<string, unknown>;
  nav.setAppBadge = async (n?: number) => void badge.push(n ?? 0);
  nav.clearAppBadge = async () => void badge.push('cleared');
  setGlobal('window', dom.window);
  setGlobal('document', dom.window.document);
  setGlobal('navigator', nav);
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  setGlobal('fetch', async (input: string) => {
    const path = new URL(input).pathname + new URL(input).search;
    requests.push(path);
    if (path.startsWith('/sync/rev')) return json({ revs: { 'inbox:7': String(rev) } });
    if (path === '/notifications/unread') return json({ unread });
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

describe('useAppBadge', () => {
  it('shows the unread total across projects on the app icon', async () => {
    await render([7, 8]);
    assert.deepEqual(badge, [2]);
    assert.ok(requests.includes('/notifications/unread'));
    assert.ok(requests.some((p) => p.startsWith('/sync/rev') && p.includes('inbox:8')));
  });

  it('clears the badge when an inbox scope moves and nothing is unread', async () => {
    await render([7]);
    unread = 0;
    rev = 2;
    await act(() => client.invalidateQueries({ queryKey: ['sync', 'rev'] }));
    await settle();
    assert.deepEqual(badge, [2, 'cleared']);
  });

  it('does nothing where the browser has no Badging API', async () => {
    delete (dom.window.navigator as unknown as Record<string, unknown>).setAppBadge;
    await render([7]);
    assert.deepEqual(badge, []);
    assert.ok(!requests.includes('/notifications/unread'));
  });
});
