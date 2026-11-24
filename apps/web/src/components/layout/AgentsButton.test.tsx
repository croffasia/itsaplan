import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { ShellCtx, type ShellContext } from '@/context/shellContext';
import { SyncProvider } from '@/context/syncContext';
import { qk } from '@/services/queryKeys';
import nav from '../../../messages/en/nav.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'DocumentFragment',
  'Element',
  'HTMLElement',
  'SVGElement',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'getComputedStyle',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let scopes: string;
let originals: Map<string, PropertyDescriptor | undefined>;

async function renderButton({
  readsAgents,
  running = 0,
}: {
  readsAgents: boolean;
  running?: number;
}) {
  const project = {
    project: { id: 3, ref: 'eng.RUN' },
    viewer: { role: 'member', teamRole: 'member', via: 'member' },
    permissions: { ai_agents: { read: readsAgents } },
  };
  client.setQueryData(qk.runningRuns('eng.RUN'), { running });
  const { default: AgentsButton } = await import('./AgentsButton');
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SyncProvider>
          <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ nav }}>
            <ShellCtx.Provider value={{ project } as unknown as ShellContext}>
              <AgentsButton open={false} onToggle={() => {}} />
            </ShellCtx.Provider>
          </NextIntlClientProvider>
        </SyncProvider>
      </QueryClientProvider>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
}

const button = () => document.querySelector('button');

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  scopes = '';
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  for (const name of replacedGlobals) {
    if (name in dom.window)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
  }
  Object.defineProperties(globalThis, {
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    fetch: {
      configurable: true,
      value: async (input: RequestInfo | URL) => {
        scopes = new URL(String(input), 'http://localhost').searchParams.get('scopes') ?? scopes;
        return Response.json({ revs: {} });
      },
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('AgentsButton', () => {
  it('is there only for whoever reads the agents', async () => {
    await renderButton({ readsAgents: true });
    assert.equal(button()?.textContent, nav.agentsPanel);

    await renderButton({ readsAgents: false });
    assert.equal(button(), null);
  });

  it('says how many runs work, and watches the queue only while one does', async () => {
    await renderButton({ readsAgents: true });
    assert.ok(!button()?.textContent?.includes('working'));
    assert.equal(scopes, 'agentRuns:3');

    await renderButton({ readsAgents: true, running: 2 });
    assert.ok(button()?.textContent?.includes('2 runs working'));
    assert.equal(scopes, 'runnerQueue:1');
  });
});
