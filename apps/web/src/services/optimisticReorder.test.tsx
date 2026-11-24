import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import { useOptimisticReorder } from './optimisticReorder';

const KEY = ['items'];
type Item = { id: number };

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let mutate: (orderedIds: number[]) => void;
const replacedGlobals = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'] as const;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function Harness() {
  // The request never settles, so the cache holds the optimistic order.
  const reorder = useOptimisticReorder<Item>(KEY, () => new Promise(() => {}));
  mutate = reorder.mutate;
  return null;
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  client = new QueryClient();
  client.setQueryData<Item[]>(KEY, [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    ),
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useOptimisticReorder', () => {
  it('keeps the items the order leaves out, after the ones it moves', async () => {
    await act(async () => mutate([4, 3]));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    assert.deepEqual(
      client.getQueryData<Item[]>(KEY)?.map((item) => item.id),
      [4, 3, 1, 2],
    );
  });
});
