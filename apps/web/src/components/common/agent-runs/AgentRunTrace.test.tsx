import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { IssueAgentRunTrace as Trace } from '@/lib/api/endpoints/issues';
import { qk } from '@/services/queryKeys';
import issue from '../../../../messages/en/issue.json';
import AgentRunTrace from './AgentRunTrace';

let root: Root;
let dom: JSDOM;
let client: QueryClient;
let descriptors: Map<string, PropertyDescriptor | undefined>;
const latest: Trace = {
  previousTraceId: 'old',
  trace: {
    traceId: 'new',
    status: 'success',
    startedAt: '2026-01-02T00:00:00Z',
    endedAt: '2026-01-02T00:00:01Z',
  },
  spans: [
    {
      spanId: 'tool-new',
      parentSpanId: 'root-new',
      name: 'get_issue',
      type: 'tool_call',
      status: 'success',
      startedAt: '2026-01-02T00:00:00Z',
      endedAt: '2026-01-02T00:00:00.050Z',
      durationMs: 50,
      input: 'Private tool input',
      output: 'Latest result',
      error: null,
      attributes: null,
    },
  ],
};
const earlier: Trace = {
  previousTraceId: null,
  trace: { ...latest.trace, traceId: 'old', startedAt: '2026-01-01T00:00:00Z' },
  spans: [{ ...latest.spans[0], spanId: 'tool-old', output: 'Earlier result' }],
};

beforeEach(async () => {
  descriptors = new Map(
    ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  dom = new JSDOM('<div id="root"></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
    fetch: {
      configurable: true,
      value: async () => Response.json({ error: 'Access denied' }, { status: 403 }),
    },
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(qk.issueAgentRunTrace(1, 2), latest);
  client.setQueryData(qk.issueAgentRunTrace(1, 2, 'old'), earlier);
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ issue }} timeZone="UTC">
          <AgentRunTrace issueId={1} runId={2} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

function click(label: string) {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent === label);
  assert.ok(button);
  act(() => button.click());
}

it('opens an earlier attempt and returns to the latest, keeping their outputs separate', () => {
  assert.ok(document.body.textContent?.includes('Latest result'));
  assert.ok(document.body.textContent?.includes('50 ms'));
  click(issue.agentRuns.previousAttempt);
  assert.ok(document.body.textContent?.includes('Earlier result'));
  assert.ok(!document.body.textContent?.includes('Latest result'));
  assert.ok(
    ![...document.querySelectorAll('button')].some(
      (button) => button.textContent === issue.agentRuns.previousAttempt,
    ),
  );
  click(issue.agentRuns.latestAttempt);
  assert.ok(document.body.textContent?.includes('Latest result'));
  assert.ok(!document.body.textContent?.includes('Earlier result'));
});

it('hides cached trace content after a refetch denies access', async () => {
  assert.ok(document.body.textContent?.includes('Private tool input'));
  await act(async () => {
    await client.invalidateQueries({ queryKey: qk.issueAgentRunTrace(1, 2), exact: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.ok(document.querySelector('[role="alert"]'));
  assert.ok(!document.body.textContent?.includes('Private tool input'));
  assert.ok(!document.body.textContent?.includes('Latest result'));
  assert.equal(document.querySelectorAll('details').length, 0);
});
