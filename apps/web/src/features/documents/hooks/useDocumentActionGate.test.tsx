import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useDocumentActionGate } from './useDocumentActionGate';

type Gate = ReturnType<typeof useDocumentActionGate>;

let dom: JSDOM;
let root: Root;
let gate: Gate | null;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function Probe() {
  gate = useDocumentActionGate();
  return null;
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
  const element = document.querySelector('#root');
  assert.ok(element);
  root = createRoot(element);
  gate = null;
  act(() => root.render(<Probe />));
  assert.ok(gate);
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useDocumentActionGate', () => {
  it('freezes editing for the whole versioned action and rejects a concurrent action', async () => {
    let resolve!: () => void;
    const deferred = new Promise<void>((done) => {
      resolve = done;
    });
    let actionPromise!: Promise<string | null>;
    act(() => {
      actionPromise = gate!.run(async () => {
        await deferred;
        return 'done';
      });
    });
    assert.equal(gate!.pending, true);

    let concurrentRan = false;
    const concurrent = await gate!.run(async () => {
      concurrentRan = true;
      return 'unexpected';
    });
    assert.equal(concurrent, null);
    assert.equal(concurrentRan, false);

    await act(async () => {
      resolve();
      assert.equal(await actionPromise, 'done');
    });
    assert.equal(gate!.pending, false);
  });
});
