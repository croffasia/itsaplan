import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { View } from '@/lib/api/endpoints/views';
import { EMPTY_FILTER_SET, type FilterCondition } from '@/utils/filters';
import { normalizeSavedDisplay } from '@/utils/viewSettings';
import { useViewEditor } from './useViewEditor';

const FILTERS_KEY = 'planner_view_filters';
const replacedGlobals = ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'] as const;

const mine: FilterCondition = { id: 'a', field: 'assignee', op: 'is', values: ['user-1'] };
const urgent: FilterCondition = { id: 'b', field: 'priority', op: 'is', values: ['urgent'] };
const bugs: FilterCondition = { id: 'c', field: 'type', op: 'is', values: [3] };

const view: View = {
  id: 7,
  projectId: 1,
  name: 'Bugs',
  icon: null,
  filters: { conditions: [bugs] },
  display: normalizeSavedDisplay({ layout: 'table' }),
  position: 0,
  shareToken: null,
  shareExtended: false,
  isPrivate: false,
  shareExpiresAt: null,
  favorite: false,
  hidden: false,
  createdAt: '2026-01-01T00:00:00Z',
};
const views = [view];

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;
let originalFetch: typeof fetch;
let editor: ReturnType<typeof useViewEditor>;

type Tab = { projectKey: string; activeViewId: number | null; fields?: { id: number }[] | null };

function EditorProbe({ projectKey, activeViewId, fields = null }: Tab) {
  editor = useViewEditor(projectKey, views, activeViewId, () => {}, true, fields);
  return null;
}

function render(tab: Tab, mountKey = 'probe') {
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{}} onError={() => {}}>
          <EditorProbe key={mountKey} {...tab} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

// A new probe instance, as after a reload: nothing carries over but localStorage.
function remount(tab: Tab) {
  render(tab, String(Math.random()));
}

function stored() {
  return JSON.parse(localStorage.getItem(FILTERS_KEY) ?? 'null');
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
  originalFetch = globalThis.fetch;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const { createRoot } = await import('react-dom/client');
  const rootElement = document.querySelector('#root');
  assert.ok(rootElement);
  root = createRoot(rootElement);
});

afterEach(() => {
  act(() => root.unmount());
  client.clear();
  globalThis.fetch = originalFetch;
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useViewEditor filters', () => {
  it('opens a tab with the filters it had before a reload', () => {
    render({ projectKey: 'P', activeViewId: null });
    act(() => editor.changeFilters({ conditions: [mine] }));

    remount({ projectKey: 'P', activeViewId: null });
    assert.deepEqual(editor.filters, { conditions: [mine] });
    assert.equal(editor.showFilters, true);
  });

  it('keeps one set for each tab of each project', () => {
    render({ projectKey: 'P', activeViewId: null });
    act(() => editor.changeFilters({ conditions: [mine] }));
    render({ projectKey: 'P', activeViewId: 7 });
    assert.deepEqual(editor.filters, EMPTY_FILTER_SET);
    act(() => editor.changeFilters({ conditions: [urgent] }));
    // The view's own conditions still apply behind the ad-hoc ones.
    assert.deepEqual(
      editor.effectiveFilters.conditions.map((c) => c.field),
      ['type', 'priority'],
    );

    render({ projectKey: 'P', activeViewId: null });
    assert.deepEqual(editor.filters, { conditions: [mine] });
    render({ projectKey: 'P', activeViewId: 7 });
    assert.deepEqual(editor.filters, { conditions: [urgent] });
    render({ projectKey: 'Q', activeViewId: null });
    assert.deepEqual(editor.filters, EMPTY_FILTER_SET);
  });

  it('removes the stored set once the filters are cleared', () => {
    render({ projectKey: 'P', activeViewId: null });
    act(() => editor.changeFilters({ conditions: [mine] }));
    act(() => editor.changeFilters(EMPTY_FILTER_SET));
    assert.deepEqual(stored(), { P: {} });

    remount({ projectKey: 'P', activeViewId: null });
    assert.deepEqual(editor.filters, EMPTY_FILTER_SET);
  });

  it('stores nothing while a draft is edited, and Cancel brings the stored set back', () => {
    render({ projectKey: 'P', activeViewId: null });
    act(() => editor.changeFilters({ conditions: [mine] }));
    act(() => editor.beginNewView());
    act(() => editor.changeFilters({ conditions: [...editor.filters.conditions, urgent] }));
    assert.deepEqual(stored(), { P: { all: { conditions: [mine] } } });

    act(() => editor.cancelEdits());
    assert.deepEqual(editor.filters, { conditions: [mine] });
  });

  it('moves the stored set into the view on Save', async () => {
    const patches: unknown[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const patch = JSON.parse(String(init?.body));
      patches.push(patch);
      return Response.json({ ...view, ...patch });
    }) as typeof fetch;

    render({ projectKey: 'P', activeViewId: 7 });
    act(() => editor.changeFilters({ conditions: [urgent] }));
    act(() => editor.beginEditView(view));
    await act(() => editor.saveEdits());

    const saved = (patches[0] as { filters: { conditions: FilterCondition[] } }).filters;
    assert.deepEqual(
      saved.conditions.map((c) => c.field),
      ['type', 'priority'],
    );
    assert.deepEqual(editor.filters, EMPTY_FILTER_SET);
    assert.deepEqual(stored(), { P: {} });
  });

  it('ignores stored data it cannot read', () => {
    localStorage.setItem(FILTERS_KEY, '{not json');
    render({ projectKey: 'P', activeViewId: null });
    assert.deepEqual(editor.filters, EMPTY_FILTER_SET);

    localStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({
        P: {
          all: {
            conditions: [
              mine,
              null,
              { id: 'x', field: 'no-such-field', op: 'is', values: ['a'] },
              { id: 'y', field: 'priority', op: 'is', values: 'urgent' },
              { id: 'z', field: 'cf:4', op: 'matches', values: ['a'] },
              { id: 'w', field: 'cf:4', op: 'contains', values: [{ text: 'a' }] },
            ],
          },
          7: 'not a set',
        },
      }),
    );
    remount({ projectKey: 'P', activeViewId: null });
    assert.deepEqual(editor.filters, { conditions: [mine] });
    render({ projectKey: 'P', activeViewId: 7 });
    assert.deepEqual(editor.filters, EMPTY_FILTER_SET);
  });

  it('drops a stored condition on a deleted custom field once the fields are known', () => {
    const onField: FilterCondition = { id: 'd', field: 'cf:7', op: 'is', values: [1] };
    const onDeletedField: FilterCondition = { id: 'e', field: 'cf:42', op: 'is', values: [2] };
    const set = { conditions: [mine, onField, onDeletedField] };
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ P: { all: set, 7: set } }));
    const fields = [{ id: 7 }];

    // Fields not loaded yet: nothing can be told apart, so nothing is dropped.
    render({ projectKey: 'P', activeViewId: null });
    assert.deepEqual(editor.filters, set);
    render({ projectKey: 'P', activeViewId: null, fields });
    assert.deepEqual(editor.filters, { conditions: [mine, onField] });
    assert.deepEqual(
      editor.effectiveFilters.conditions.map((c) => c.field),
      ['assignee', 'cf:7'],
    );

    // Fields already known when another tab loads its stored set.
    render({ projectKey: 'P', activeViewId: 7, fields });
    assert.deepEqual(editor.filters, { conditions: [mine, onField] });

    // The next change stores the set without it.
    act(() => editor.changeFilters({ conditions: [onField] }));
    assert.deepEqual(stored().P[7], { conditions: [onField] });
  });
  it('reads the fields against the set of the project they belong to', () => {
    const inP: FilterCondition = { id: 'p', field: 'cf:7', op: 'is', values: [1] };
    const inQ: FilterCondition = { id: 'q', field: 'cf:9', op: 'is', values: [1] };
    localStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({ P: { all: { conditions: [inP] } }, Q: { all: { conditions: [inQ] } } }),
    );
    render({ projectKey: 'P', activeViewId: null, fields: [{ id: 7 }] });
    assert.deepEqual(editor.filters, { conditions: [inP] });

    // Q's fields are already known when its set loads: P's set, still live in that
    // commit, must not be what is kept.
    render({ projectKey: 'Q', activeViewId: null, fields: [{ id: 9 }] });
    assert.deepEqual(editor.filters, { conditions: [inQ] });
    assert.deepEqual(stored(), {
      P: { all: { conditions: [inP] } },
      Q: { all: { conditions: [inQ] } },
    });
  });
});
