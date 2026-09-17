import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import type { View } from '@/lib/api/endpoints/views';
import { EMPTY_FILTER_SET, type FilterSet } from '@/utils/filters';
import { defaultViewSettings, getViewSettings, setViewSettings } from '@/utils/viewSettings';
import { useViewEditor } from './useViewEditor';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'localStorage',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;
const widgetFilters: FilterSet = {
  conditions: [
    { id: 'status', field: 'statusType', op: 'is', values: ['started'] },
    { id: 'owner', field: 'assignee', op: 'is', values: [null, 'user-1'] },
  ],
};
const savedView: View = {
  id: 7,
  projectId: 1,
  name: 'Completed',
  icon: null,
  filters: { conditions: [{ id: 'done', field: 'statusType', op: 'is', values: ['completed'] }] },
  display: { layout: 'calendar', ...defaultViewSettings('calendar') },
  position: 0,
  shareToken: null,
  shareExtended: false,
  favorite: false,
  createdAt: '2026-01-01T00:00:00Z',
};

let dom: JSDOM;
let root: Root;
let queryClient: QueryClient;
let editor: ReturnType<typeof useViewEditor>;
let selected: (number | null)[];
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function Probe({
  activeViewId,
  views,
  projectKey,
}: {
  activeViewId: number | null;
  views: View[];
  projectKey: string | null;
}) {
  editor = useViewEditor(projectKey, views, activeViewId, (id) => selected.push(id));
  return null;
}

function render(
  activeViewId: number | null = null,
  views = [savedView],
  projectKey: string | null = 'TEST',
) {
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe activeViewId={activeViewId} views={views} projectKey={projectKey} />
      </QueryClientProvider>,
    ),
  );
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test' });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    localStorage: { configurable: true, value: dom.window.localStorage },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  selected = [];
  const { createRoot } = await import('react-dom/client');
  const element = document.querySelector('#root');
  assert.ok(element);
  root = createRoot(element);
});

afterEach(() => {
  act(() => root.unmount());
  queryClient.clear();
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useViewEditor.openFilteredIssues', () => {
  it('opens the exact filter in a flat table without changing stored preferences', () => {
    localStorage.setItem('planner_view', 'calendar');
    const storedTable = { ...defaultViewSettings('table'), group: 'priority' as const };
    setViewSettings('TEST', 'table', storedTable);
    render();
    act(() => editor.beginNewView());
    act(() => editor.setDraftName('Unsaved view'));
    act(() => editor.openFilteredIssues(widgetFilters));

    assert.deepEqual(selected, [null]);
    assert.equal(editor.view, 'table');
    assert.equal(editor.settings.group, 'none');
    assert.equal(editor.settings.subgroup, 'none');
    assert.equal(editor.settings.separateSubtasks, true);
    assert.equal(editor.settings.showSubtasks, false);
    assert.deepEqual(editor.settings.hiddenGroups, []);
    assert.deepEqual(editor.settings.collapsedGroups, []);
    assert.equal(editor.editing, false);
    assert.equal(editor.draftName, '');
    assert.equal(editor.showFilters, true);
    assert.deepEqual(editor.filters, widgetFilters);
    assert.equal(localStorage.getItem('planner_view'), 'calendar');
    assert.deepEqual(getViewSettings('TEST', 'table'), storedTable);
    assert.equal(queryClient.getMutationCache().getAll().length, 0);
  });

  it('keeps the selection across navigation and refetch, then restores a saved view normally', () => {
    render(savedView.id);
    const originalView = structuredClone(savedView);
    act(() => editor.beginEditView(savedView));
    act(() => editor.openFilteredIssues(widgetFilters));
    render(savedView.id, [structuredClone(savedView)]);
    render(null);
    render(null, [structuredClone(savedView)]);

    assert.equal(editor.view, 'table');
    assert.deepEqual(editor.filters, widgetFilters);
    assert.deepEqual(
      editor.effectiveFilters.conditions.map((c) => c.values),
      [['started'], [null, 'user-1']],
    );
    assert.equal(editor.editing, false);
    assert.deepEqual(savedView, originalView);

    act(() => editor.selectView(savedView.id));
    render(savedView.id);
    assert.equal(editor.view, 'calendar');
    assert.deepEqual(editor.filters, EMPTY_FILTER_SET);
    assert.equal(editor.effectiveFilters.conditions[0]?.values[0], 'completed');
  });

  it('replaces previous filters and keeps an empty selection visibly unfiltered', () => {
    render();
    act(() => editor.changeFilters(savedView.filters));
    act(() => editor.openFilteredIssues(widgetFilters));
    assert.deepEqual(editor.filters, widgetFilters);
    act(() => editor.openFilteredIssues(EMPTY_FILTER_SET));
    assert.deepEqual(editor.effectiveFilters, EMPTY_FILTER_SET);
    assert.equal(editor.showFilters, true);
  });

  it('does not share mutable conditions with the widget configuration', () => {
    render();
    act(() => editor.openFilteredIssues(widgetFilters));
    assert.notEqual(editor.filters, widgetFilters);
    assert.notEqual(editor.filters.conditions[0], widgetFilters.conditions[0]);
    assert.notEqual(editor.filters.conditions[0]?.values, widgetFilters.conditions[0]?.values);
  });

  it('does not carry the drill-down into a different project', () => {
    render();
    act(() => editor.openFilteredIssues(widgetFilters));
    render(null, [], 'OTHER');
    assert.deepEqual(editor.filters, EMPTY_FILTER_SET);
    assert.equal(editor.view, 'kanban');
  });

  it('does nothing without an active project', () => {
    render(null, [], null);
    act(() => editor.openFilteredIssues(widgetFilters));
    assert.deepEqual(selected, []);
    assert.deepEqual(editor.filters, EMPTY_FILTER_SET);
    assert.equal(editor.view, 'kanban');
  });
});
