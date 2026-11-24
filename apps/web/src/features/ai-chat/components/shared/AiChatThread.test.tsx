import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { AiChatThread } from './AiChatThread';
import common from '../../../../../messages/en/common.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'Event',
  'MutationObserver',
  'getComputedStyle',
  'ResizeObserver',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

const agent = { id: 1, name: 'Developer', kind: 'internal', memoryEnabled: true } as AiAgent;

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let missing: string[];
let answer: () => Response;
let originals: Map<string, PropertyDescriptor | undefined>;

async function renderThread() {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ common }}>
          <AiChatThread
            projectKey="eng.RUN"
            agent={agent}
            threadId="kept"
            onThreadCreated={() => {}}
            onThreadMissing={(threadId) => missing.push(threadId)}
            onStateChange={() => {}}
            empty={null}
            composerStart={null}
            composerEnd={null}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
}

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  missing = [];
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
    ResizeObserver: {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    },
    fetch: { configurable: true, value: async () => answer() },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

describe('AiChatThread', () => {
  it('reports a conversation that is not there any more', async () => {
    answer = () => Response.json({ error: 'Thread not found' }, { status: 404 });
    await renderThread();
    assert.deepEqual(missing, ['kept']);
  });

  it('keeps a conversation it could not read', async () => {
    answer = () => Response.json({ error: 'Internal error' }, { status: 500 });
    await renderThread();
    assert.deepEqual(missing, []);
  });
});
