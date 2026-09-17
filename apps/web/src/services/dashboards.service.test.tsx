import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import { useCreateDashboard } from './dashboards.service';
import { qk } from './queryKeys';
import type { Dashboard } from '@/lib/api/endpoints/dashboards';

let root: Root;
let dom: JSDOM;
let client: QueryClient;
let create: ReturnType<typeof useCreateDashboard>;
let descriptors: Map<string, PropertyDescriptor | undefined>;
const created: Dashboard = {
  id: 8,
  projectId: 1,
  name: 'New dashboard',
  icon: null,
  layout: [],
  position: 1,
  createdAt: '2026-01-01T00:00:00Z',
};
function Harness() {
  create = useCreateDashboard('TEST');
  return null;
}
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
    fetch: { configurable: true, value: async () => Response.json(created) },
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    ),
  );
});
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  act(() => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});
it('makes a created dashboard available before navigation without waiting for a list refetch', async () => {
  const previous = { ...created, id: 7, name: 'Existing' };
  client.setQueryData(qk.dashboards('TEST'), [previous]);
  await act(async () => {
    await create.mutateAsync({ input: { name: created.name } });
  });
  assert.deepEqual(client.getQueryData(qk.dashboards('TEST')), [previous, created]);
});
it('retains one copy when the list already contains the created dashboard', async () => {
  client.setQueryData(qk.dashboards('TEST'), [created]);
  await act(async () => {
    await create.mutateAsync({ input: { name: created.name } });
  });
  assert.deepEqual(client.getQueryData(qk.dashboards('TEST')), [created]);
});
