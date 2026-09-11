import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { SubtasksProvider, useSubtaskFold } from './useSubtasks';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

// Reports what one card or row would show, and offers the toggle its chevron calls.
function FoldProbe() {
  const { open, toggle } = useSubtaskFold();
  return (
    <button type="button" onClick={toggle}>
      {open ? 'open' : 'folded'}
    </button>
  );
}

function render(collapsed: boolean) {
  act(() =>
    root.render(
      <SubtasksProvider issues={[]} enabled collapsed={collapsed}>
        <FoldProbe />
        <FoldProbe />
      </SubtasksProvider>,
    ),
  );
}

const states = () => [...document.querySelectorAll('button')].map((b) => b.textContent);

const clickFirst = () =>
  act(() => {
    document
      .querySelector('button')
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>');

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });

  const { createRoot } = await import('react-dom/client');
  const rootElement = document.querySelector('#root');
  assert.ok(rootElement);
  root = createRoot(rootElement);
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useSubtaskFold', () => {
  it('follows the display setting', () => {
    render(false);
    assert.deepEqual(states(), ['open', 'open']);

    render(true);
    assert.deepEqual(states(), ['folded', 'folded']);
  });

  it('unfolds the one card the chevron was clicked on', () => {
    render(true);
    clickFirst();
    assert.deepEqual(states(), ['open', 'folded']);
  });

  it('takes a hand-made choice back when the setting changes', () => {
    render(true);
    clickFirst();
    assert.deepEqual(states(), ['open', 'folded']);

    // The switch moves every card, including the one unfolded by hand.
    render(false);
    assert.deepEqual(states(), ['open', 'open']);
    render(true);
    assert.deepEqual(states(), ['folded', 'folded']);
  });
});
