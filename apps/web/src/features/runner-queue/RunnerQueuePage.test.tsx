import assert from 'node:assert/strict';
import { it } from 'node:test';
import { act } from 'react';
import { JSDOM } from 'jsdom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { SyncProvider } from '@/context/syncContext';
import { RelativeTimeProvider } from '@/context/relativeTimeContext';
import { qk } from '@/services/queryKeys';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import issue from '../../../messages/en/issue.json';
import common from '../../../messages/en/common.json';

it('keeps selected results when the run leaves the list page and hides them after access denial', async () => {
  const names = [
    'window',
    'document',
    'navigator',
    'Node',
    'NodeFilter',
    'DocumentFragment',
    'Element',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLFormElement',
    'HTMLSelectElement',
    'SVGElement',
    'ShadowRoot',
    'Event',
    'CustomEvent',
    'MutationObserver',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'ResizeObserver',
    'fetch',
    'IS_REACT_ACT_ENVIRONMENT',
  ] as const;
  const descriptors = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });
  const run: RunnerQueueRun = {
    id: 1,
    agentId: 1,
    username: 'runner',
    kind: 'external',
    status: 'success',
    executionState: 'success',
    trigger: 'manual',
    prompt: 'Inspect task',
    output: 'Selected result',
    attempts: 1,
    lastError: null,
    createdAt: '2026-01-01T00:00:00Z',
    startedAt: null,
    finishedAt: null,
    nextAttemptAt: '2026-01-01T00:00:00Z',
    issueId: null,
    sequenceNumber: null,
    issueTitle: null,
    projectRef: 'team.RUN',
    runnerState: 'online',
  };
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
    fetch: { configurable: true, value: async () => Response.json(null) },
  });
  for (const name of names) {
    if (name in dom.window)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
  }
  Object.defineProperties(globalThis, {
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    requestAnimationFrame: {
      configurable: true,
      value: dom.window.requestAnimationFrame.bind(dom.window),
    },
    cancelAnimationFrame: {
      configurable: true,
      value: dom.window.cancelAnimationFrame.bind(dom.window),
    },
    ResizeObserver: {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const listKey = [...qk.runnerQueue, { page: 1, pageSize: 10 }];
  const detailKey = [...qk.runnerQueue, { page: 1, pageSize: 1, runId: 1 }];
  const page = { items: [run], total: 1, page: 1, pageSize: 10, queued: 0, running: 0 };
  client.setQueryData(listKey, page);
  client.setQueryData(detailKey, page);
  client.setQueryData([...qk.externalRunTrace(1), null], null);
  const { default: RunnerQueuePage } = await import('./RunnerQueuePage');
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <SyncProvider>
            <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ issue, common }}>
              <RelativeTimeProvider>
                <RunnerQueuePage />
              </RelativeTimeProvider>
            </NextIntlClientProvider>
          </SyncProvider>
        </QueryClientProvider>,
      ),
    );
    const button = document.querySelector('button[aria-pressed="false"]') as HTMLButtonElement;
    assert.ok(button);
    await act(async () => button.click());
    assert.ok(document.body.textContent?.includes('Selected result'));
    await act(async () => {
      client.setQueryData(listKey, { ...page, items: [{ ...run, id: 2 }] });
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    assert.ok(document.body.textContent?.includes('Selected result'));
    await act(async () => {
      client
        .getQueryCache()
        .find({ queryKey: detailKey })!
        .setState({ status: 'error', error: new Error('Denied') });
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    assert.ok(!document.body.textContent?.includes('Selected result'));
  } finally {
    await act(async () => root.unmount());
    client.clear();
    dom.window.close();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
