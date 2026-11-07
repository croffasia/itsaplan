import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { SyncProvider, useSyncSubscribe } from './syncContext';

const replacedGlobals = ['window', 'document', 'navigator', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'];

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let saved: Map<string, PropertyDescriptor | undefined>;
let rev: number;
let revRequests: string[][];
let lastScopeReads: number;

const scopes = Array.from({ length: 25 }, (_, i) => `board:${i + 1}`);
const lastScope = scopes[scopes.length - 1];

function Probe() {
  const subscribe = useSyncSubscribe();
  useEffect(() => {
    const off = scopes.map((scope) => subscribe({ scope, targets: [['probe', scope]] }));
    return () => off.forEach((o) => o());
  }, [subscribe]);
  useQuery({ queryKey: ['probe', lastScope], queryFn: () => ++lastScopeReads });
  return null;
}

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

async function settle() {
  for (let i = 0; i < 10; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

beforeEach(() => {
  saved = new Map(replacedGlobals.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]));
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://web.test/' });
  rev = 1;
  revRequests = [];
  lastScopeReads = 0;
  setGlobal('window', dom.window);
  setGlobal('document', dom.window.document);
  setGlobal('navigator', dom.window.navigator);
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  setGlobal('fetch', async (input: string) => {
    const url = new URL(input);
    const requested = url.searchParams.get('scopes')!.split(',');
    revRequests.push(requested);
    if (requested.length > 20) return new Response('{}', { status: 400 });
    const revs = Object.fromEntries(requested.map((s) => [s, String(rev)]));
    return new Response(JSON.stringify({ revs }), {
      headers: { 'content-type': 'application/json' },
    });
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

describe('SyncProvider', () => {
  it('reads more scopes than one request takes in batches', async () => {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <SyncProvider>
            <Probe />
          </SyncProvider>
        </QueryClientProvider>,
      ),
    );
    await settle();

    assert.ok(revRequests.every((r) => r.length <= 20));
    assert.deepEqual(revRequests.slice(-2).flat().sort(), [...scopes].sort());

    const reads = lastScopeReads;
    rev = 2;
    await act(() => client.invalidateQueries({ queryKey: ['sync', 'rev'] }));
    await settle();
    assert.equal(lastScopeReads, reads + 1);
  });
});
