import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useDroppedOrder } from './dnd';

type Item = { id: number };

let dom: JSDOM;
let root: Root;
let drop: (ids: number[]) => void;
let shown: number[];
const replacedGlobals = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'] as const;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function Harness({ items }: { items: Item[] }) {
  const dropped = useDroppedOrder(items);
  drop = dropped.drop;
  shown = dropped.items.map((item) => item.id);
  return null;
}

const list = (...ids: number[]) => ids.map((id) => ({ id }));

async function render(items: Item[]) {
  await act(async () => root.render(<Harness items={items} />));
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
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useDroppedOrder', () => {
  it('shows the dropped order at once, before the data reaches the list', async () => {
    await render(list(1, 2, 3));
    await act(async () => drop([3, 1, 2]));
    assert.deepEqual(shown, [3, 1, 2]);
  });

  it('follows the data once it changes', async () => {
    await render(list(1, 2, 3));
    await act(async () => drop([3, 1, 2]));
    await render(list(3, 1, 2));
    assert.deepEqual(shown, [3, 1, 2]);
    await render(list(2, 3, 1));
    assert.deepEqual(shown, [2, 3, 1]);
  });

  it('shows the data again when a failed move rolls it back', async () => {
    await render(list(1, 2, 3));
    await act(async () => drop([3, 1, 2]));
    await render(list(3, 1, 2));
    await render(list(1, 2, 3));
    assert.deepEqual(shown, [1, 2, 3]);
  });
});
