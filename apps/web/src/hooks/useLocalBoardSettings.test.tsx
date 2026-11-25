import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { EMPTY_FILTER_SET, type FilterCondition } from '@/utils/filters';
import { useLocalBoardSettings } from './useLocalBoardSettings';

const STORE_KEY = 'test_board_settings';
const replacedGlobals = ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'] as const;

let dom: JSDOM;
let root: Root;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;
let board: ReturnType<typeof useLocalBoardSettings>;

const mine: FilterCondition = { id: 'a', field: 'assignee', op: 'is', values: ['user-1'] };

function BoardProbe({ id = 1 }: { id?: number }) {
  board = useLocalBoardSettings(STORE_KEY, id);
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

  it('keeps the filters of each board, next to its display, across a remount', () => {
    act(() => root.render(<BoardProbe />));
    act(() => board.changeFilters({ conditions: [mine] }));
    act(() => board.changeView('table'));
    act(() => board.changeSettings({ ...board.settings, properties: ['priority'] }));

    act(() => root.render(<BoardProbe key="again" />));
    assert.deepEqual(board.filters, { conditions: [mine] });
    assert.equal(board.view, 'table');
    act(() => root.render(<BoardProbe id={2} />));
    assert.deepEqual(board.filters, EMPTY_FILTER_SET);
  });

  it('drops the stored filters once cleared, and ignores ones it cannot read', () => {
    act(() => root.render(<BoardProbe />));
    act(() => board.changeFilters({ conditions: [mine] }));
    act(() => board.changeFilters(EMPTY_FILTER_SET));
    assert.deepEqual(JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null'), { 1: {} });

    localStorage.setItem(STORE_KEY, JSON.stringify({ 1: { filters: { conditions: 'mine' } } }));
    act(() => root.render(<BoardProbe key="again" />));
    assert.deepEqual(board.filters, EMPTY_FILTER_SET);
  });
});
