import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, type ComponentType, type ContextType } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';
import messages from '../../../../../messages/en/workItems.json';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import { ColumnSearchContext } from '../../context/columnSearchContext';
import { useColumnSearchState } from '../../hooks/useColumnSearchState';
import { prepareColumnSearchEntries, searchColumnEntries } from '../../utils/columnSearch';

type Search = NonNullable<ContextType<typeof ColumnSearchContext>>;
let search: Search;
let root: Root;
let dom: JSDOM;
let originals: Map<string, PropertyDescriptor | undefined>;
let Panel: ComponentType;
let Surface: ComponentType;
let loading = false;
let modal = false;
let overlayOpen = false;
const fields: never[] = [];
const issues = Array.from({ length: 600 }, (_, index) => ({
  id: index + 1,
  identifier: `TEST-${index + 1}`,
  sequenceNumber: index + 1,
  title: `Task ${index + 1}`,
  description: '',
  archivedAt: null,
  fieldValues: [],
  parentId: null,
  columnId: 1,
  typeId: null,
  assigneeUserId: null,
  priority: null,
})) as unknown as BoardIssue[];
const entries = prepareColumnSearchEntries(issues, fields);
const router = {
  pathname: '/project/TEST',
  asPath: '/project/TEST',
  push: () => {
    throw new Error('Task activation must use the board opening callback');
  },
} as NonNullable<ContextType<typeof RouterContext>>;

function Probe() {
  const state = useColumnSearchState('test:status', '/project/TEST');
  search = {
    ...state,
    results: searchColumnEntries(entries, state.matchQuery, 'TEST'),
    total: entries.length,
    group: { key: 'c1', name: 'Direct skill links' },
    project: { project: { key: 'TEST', name: 'Test board', subtasksEnabled: true } },
    settings: { properties: [], subgroup: 'none' },
    maps: { columnById: new Map(), typeById: new Map(), assigneeById: new Map() },
    parentById: new Map(),
    laneNames: new Map(),
    filtered: false,
    filterKey: '',
    loading,
    hasData: !loading,
    error: undefined,
    denied: false,
    retry: undefined,
    viewFilters: undefined,
    enabled: true,
    externalOverlayOpen: overlayOpen,
    issueHref: (issue: BoardIssue) => `/project/TEST/issue/${issue.sequenceNumber}`,
    openIssue: (id: number) => {
      state.draft.focusedId = id;
      state.returnToResult.current = true;
      state.capture();
    },
  } as unknown as Search;
  return (
    <RouterContext.Provider value={router}>
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ workItems: messages }}>
        <ColumnSearchContext.Provider value={search}>
          <button
            ref={(element) => {
              if (element) state.entryRefs.current.set('c1', element);
            }}
          >
            Search tasks
          </button>
          {state.active?.mode === 'inline' && <Panel />}
          <Surface />
        </ColumnSearchContext.Provider>
      </NextIntlClientProvider>
    </RouterContext.Provider>
  );
}

beforeEach(async () => {
  originals = new Map(
    [
      'window',
      'document',
      'navigator',
      'HTMLElement',
      'HTMLInputElement',
      'Element',
      'Node',
      'NodeFilter',
      'MutationObserver',
      'CustomEvent',
      'Event',
      'ResizeObserver',
      'getComputedStyle',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'IS_REACT_ACT_ENVIRONMENT',
    ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://planner.test/project/TEST',
    pretendToBeVisual: true,
  });
  const resizeObserver = class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            borderBoxSize: [{ inlineSize: 320, blockSize: (target as HTMLElement).offsetHeight }],
          },
        ] as unknown as ResizeObserverEntry[],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  };
  for (const key of [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'HTMLInputElement',
    'Element',
    'Node',
    'NodeFilter',
    'MutationObserver',
    'CustomEvent',
    'Event',
    'getComputedStyle',
  ] as const) {
    const value = key === 'window' ? dom.window : dom.window[key];
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  Object.defineProperties(globalThis, {
    ResizeObserver: { configurable: true, value: resizeObserver },
    requestAnimationFrame: {
      configurable: true,
      value: dom.window.requestAnimationFrame.bind(dom.window),
    },
    cancelAnimationFrame: {
      configurable: true,
      value: dom.window.cancelAnimationFrame.bind(dom.window),
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  Object.defineProperty(dom.window, 'ResizeObserver', { value: resizeObserver });
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetHeight', {
    get() {
      return this.hasAttribute('data-index') ? 128 : 400;
    },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', { get: () => 320 });
  Object.defineProperty(dom.window.HTMLElement.prototype, 'clientHeight', { get: () => 400 });
  Object.defineProperty(dom.window.HTMLElement.prototype, 'scrollHeight', {
    get() {
      return (
        Number.parseFloat((this.firstElementChild as HTMLElement | null)?.style.height ?? '400') ||
        400
      );
    },
  });
  dom.window.HTMLElement.prototype.scrollTo = function (options) {
    const next = typeof options === 'object' ? (options.top ?? 0) : 0;
    if (next === this.scrollTop) return;
    this.scrollTop = next;
    dom.window.setTimeout(() => this.dispatchEvent(new dom.window.Event('scroll')), 0);
  };
  modal = false;
  loading = false;
  overlayOpen = false;
  window.matchMedia = (() => ({ matches: !modal })) as unknown as typeof window.matchMedia;
  Panel = (await import('./ColumnSearchPanel')).ColumnSearchPanel;
  Surface = (await import('./ColumnSearchSurface')).ColumnSearchSurface;
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  act(() => root.render(<Probe />));
});

afterEach(async () => {
  act(() => root.unmount());
  await new Promise((resolve) => setTimeout(resolve, 5));
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const frame = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
const key = (element: Element, value: string) =>
  act(() =>
    element.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
    ),
  );

describe('column search controls and results', () => {
  it('focuses the visible search input and makes every virtualized task reachable by keyboard', async () => {
    act(() => search.open('c1'));
    await frame();
    const input = document.querySelector('input')!;
    assert.equal(document.activeElement, input);
    assert.equal(input.type, 'search');
    assert.match(document.body.textContent ?? '', /600 tasks in this column/);
    assert.ok(document.querySelectorAll('[data-search-task]').length < 100);
    key(input, 'ArrowDown');
    await frame();
    assert.equal(document.activeElement?.getAttribute('data-search-task'), '1');
    key(document.activeElement!, 'End');
    await frame();
    assert.equal(document.activeElement?.getAttribute('data-search-task'), '600');
    assert.ok(
      document.querySelector<HTMLElement>('[data-column-search-results]')!.scrollTop > 60_000,
    );
    assert.equal(document.activeElement?.getAttribute('href'), '/project/TEST/issue/600');
    key(document.activeElement!, 'Home');
    await frame();
    assert.equal(document.activeElement?.getAttribute('data-search-task'), '1');
    assert.equal(document.querySelector<HTMLElement>('[data-column-search-results]')!.scrollTop, 0);
  });

  it('preserves IME input and uses desktop Escape to clear before closing', async () => {
    act(() => search.open('c1'));
    act(() => search.changeQuery('日本', false));
    const input = document.querySelector('input')!;
    search.composing.current = true;
    key(input, 'Escape');
    assert.equal(search.query, '日本');
    assert.equal(search.active?.key, 'c1');
    search.composing.current = false;
    act(() => search.changeQuery('日本'));
    key(input, 'Escape');
    assert.equal(search.query, '');
    assert.equal(search.active?.key, 'c1');
    key(input, 'Escape');
    await frame();
    assert.equal(search.active, null);
    assert.equal(document.activeElement, search.entryRefs.current.get('c1'));
  });

  it('shows a loading state without reporting zero tasks, and keeps the input usable', () => {
    loading = true;
    act(() => root.render(<Probe />));
    act(() => search.open('c1'));
    act(() => search.changeQuery('draft'));
    assert.equal(document.querySelector('input')?.value, 'draft');
    assert.match(document.body.textContent ?? '', /Loading tasks/);
    assert.doesNotMatch(document.body.textContent ?? '', /0 tasks|No tasks match/);
  });

  it('suspends the touch modal for task details and restores the originating result', async () => {
    modal = true;
    act(() => search.open('c1'));
    await frame();
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
    const dialog = document.querySelector('[role="dialog"]')!;
    assert.ok(dialog.classList.contains('translate-x-0'));
    assert.ok(dialog.classList.contains('translate-y-0'));
    assert.ok(!dialog.classList.contains('translate-x-[-50%]'));
    assert.ok(!dialog.classList.contains('translate-y-[-50%]'));
    assert.equal(document.activeElement, document.querySelector('input'));
    act(() => search.resultsRef.current?.focusIssue(600));
    await frame();
    const result = document.querySelector<HTMLAnchorElement>('[data-search-task="600"]')!;
    assert.equal(result.getAttribute('href'), '/project/TEST/issue/600');
    act(() => result.click());
    assert.equal(search.returnToResult.current, true);
    assert.equal(search.draft.focusedId, 600);
    overlayOpen = true;
    act(() => root.render(<Probe />));
    await frame();
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 0);
    loading = true;
    overlayOpen = false;
    act(() => root.render(<Probe />));
    await frame();
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
    assert.equal(document.activeElement, document.querySelector('input'));
    loading = false;
    act(() => root.render(<Probe />));
    await frame();
    assert.equal(document.activeElement?.getAttribute('data-search-task'), '600');
  });
});
