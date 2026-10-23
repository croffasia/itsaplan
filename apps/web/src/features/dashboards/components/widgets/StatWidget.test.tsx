import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import { ShellCtx } from '@/context/shellContext';
import { useViewEditor } from '@/hooks/useViewEditor';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { applyFilters, type FilterSet } from '@/utils/filters';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { withoutShownSubtasks } from '@/utils/subtasks';
import messages from '../../../../../messages/en/dashboards.json';
import { projectFixture } from './statWidget.test-fixtures';
import StatWidget from './StatWidget';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'localStorage',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;
const filters: FilterSet = {
  conditions: [{ id: 'started', field: 'statusType', op: 'is', values: ['started'] }],
};

let dom: JSDOM;
let root: Root;
let queryClient: QueryClient;
let editor: ReturnType<typeof useViewEditor>;
let selected: (number | null)[];
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function Probe({
  project,
  editing,
  config,
  title,
}: {
  project: ProjectDetail | null;
  editing: boolean;
  config: WidgetConfig;
  title: string;
}) {
  editor = useViewEditor(project?.project.key ?? null, [], null, (id) => selected.push(id));
  return (
    <ShellCtx.Provider
      value={{
        project,
        filteredProject: project,
        editor,
        views: [],
        customFields: [],
        filterContext: {},
        onOpenIssue: () => undefined,
        onAddIssue: () => undefined,
        onChatWithAgent: () => undefined,
      }}
    >
      <StatWidget config={config} title={title} editing={editing} />
    </ShellCtx.Provider>
  );
}

function render({
  project = projectFixture(),
  editing = false,
  config = { filters },
  title = 'In progress',
}: {
  project?: ProjectDetail | null;
  editing?: boolean;
  config?: WidgetConfig;
  title?: string;
} = {}) {
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={{ dashboards: messages }} timeZone="UTC">
          <Probe project={project} editing={editing} config={config} title={title} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

function clickStat() {
  const button = document.querySelector('button');
  assert.ok(button);
  act(() => button.click());
  return button;
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

describe('StatWidget navigation', () => {
  it('lets a read-only member open exactly the counted parent and subtask', () => {
    const project = projectFixture();
    render({ project });
    const button = clickStat();
    assert.equal(button.textContent, '2');
    assert.equal(button.getAttribute('aria-label'), 'View issues: In progress (2)');
    assert.equal(button.type, 'button');
    assert.equal(button.tabIndex, 0);
    assert.deepEqual(selected, [null]);
    assert.deepEqual(editor.filters, filters);

    const matching = applyFilters(project.issues, editor.effectiveFilters, project);
    const rows = editor.settings.separateSubtasks ? matching : withoutShownSubtasks(matching);
    assert.deepEqual(
      rows.map((issue) => issue.id),
      [1, 2],
    );
    assert.equal(rows.length, Number(button.textContent));
    assert.equal(editor.settings.showSubtasks, false);
  });

  it('keeps zero counts navigable and preserves the zero-result filter', () => {
    const zeroFilters: FilterSet = {
      conditions: [{ id: 'empty', field: 'statusType', op: 'is', values: ['backlog'] }],
    };
    render({ config: { filters: zeroFilters } });
    assert.equal(clickStat().textContent, '0');
    assert.deepEqual(editor.filters, zeroFilters);
  });

  it('opens all issues for an unfiltered widget and uses the default title', () => {
    render({ config: {}, title: '' });
    const button = clickStat();
    assert.equal(button.textContent, '3');
    assert.equal(button.getAttribute('aria-label'), 'View issues: Number (3)');
    assert.deepEqual(editor.effectiveFilters.conditions, []);
    assert.equal(editor.showFilters, true);
  });

  it('preserves a stored presence filter that omits the unused values array', () => {
    const stored: FilterSet = JSON.parse(
      '{"conditions":[{"id":"no-date","field":"dueDate","op":"is_not_set"}]}',
    );
    render({ config: { filters: stored } });
    assert.equal(clickStat().textContent, '3');
    assert.deepEqual(editor.filters.conditions, [
      { id: 'no-date', field: 'dueDate', op: 'is_not_set', values: [] },
    ]);
  });

  it('does not navigate while editing the dashboard layout', () => {
    render({ editing: true });
    assert.equal(document.querySelector('button'), null);
    assert.equal(document.querySelector('#root')?.textContent, '2');
    assert.deepEqual(selected, []);
    render({ editing: false });
    clickStat();
    assert.deepEqual(selected, [null]);
  });

  it('does not offer navigation without work-item read permission', () => {
    const project = projectFixture();
    project.permissions.work_items.read = false;
    render({ project });
    assert.equal(document.querySelector('button'), null);
    assert.deepEqual(selected, []);
  });

  it('waits for the project rather than making a loading skeleton interactive', () => {
    render({ project: null });
    assert.equal(document.querySelector('button'), null);
    assert.ok(document.querySelector('[data-slot="skeleton"]'));
    assert.deepEqual(selected, []);
  });
});
