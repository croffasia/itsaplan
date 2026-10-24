import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useLocalBoardSettings } from './useLocalBoardSettings';

const STORE_KEY = 'test_board_settings';
const replacedGlobals = ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'] as const;

let dom: JSDOM;
let root: Root;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;
let board: ReturnType<typeof useLocalBoardSettings>;

function BoardProbe() {
  board = useLocalBoardSettings(STORE_KEY, 1);
  return null;
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    localStorage: { configurable: true, value: dom.window.localStorage },
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

describe('useLocalBoardSettings', () => {
  it('keeps the display of each layout apart, starting from an entry stored flat', () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ 1: { layout: 'table', properties: ['priority'] } }),
    );
    act(() => root.render(<BoardProbe />));
    assert.equal(board.view, 'table');
    assert.deepEqual(board.settings.properties, ['priority']);

    act(() => board.changeView('timeline'));
    assert.deepEqual(board.settings.properties, []);
    act(() => board.changeSettings({ ...board.settings, properties: ['status'] }));

    act(() => board.changeView('table'));
    assert.deepEqual(board.settings.properties, ['priority']);
    act(() => board.changeView('timeline'));
    assert.deepEqual(board.settings.properties, ['status']);
  });
});
