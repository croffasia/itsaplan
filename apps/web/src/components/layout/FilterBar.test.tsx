import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { FilterSet } from '@/utils/filters';
import common from '../../../messages/en/common.json';
import filters from '../../../messages/en/filters.json';
import FilterBar from './FilterBar';

// Radix turns its layout effects on when it first loads with a document, which depends
// on the test files run before this one in the same process. The pills' pickers then
// need these.
const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'DocumentFragment',
  'Element',
  'HTMLElement',
  'HTMLFormElement',
  'MutationObserver',
  'getComputedStyle',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

// A project without the user, the label and the custom field the conditions name.
const project = {
  project: { ref: 'P' },
  columns: [],
  assignees: [],
  issueTypes: [],
  labels: [],
  labelGroups: [],
  plannedCycles: [],
  issues: [],
} as unknown as ProjectDetail;

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;
let originalFetch: typeof fetch;
let changes: FilterSet[];

async function render(set: FilterSet) {
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider
          locale="en"
          messages={{ common, filters }}
          timeZone="UTC"
          onError={() => {}}
        >
          <FilterBar
            filters={set}
            onChange={(next) => changes.push(next)}
            project={project}
            customFields={[]}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
  // The bar asks for the initiative options once the render's effects ran. Their answer
  // has to land inside act, or React commits it after the globals are put back.
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
}

function clearButton() {
  return [...document.querySelectorAll('button')].find(
    (b) => b.textContent === common.clearFilters,
  );
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
  for (const name of replacedGlobals) {
    if (name in dom.window) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
    }
  }
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  });
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json([])) as unknown as typeof fetch;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  changes = [];

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

describe('FilterBar', () => {
  it('offers no clear button without a condition', async () => {
    await render({ conditions: [] });
    assert.equal(clearButton(), undefined);
  });

  it('clears conditions on a user, a label and a field that no longer exist', async () => {
    await render({
      conditions: [
        { id: 'a', field: 'assignee', op: 'is', values: ['removed-user'] },
        { id: 'b', field: 'labels', op: 'is', values: [99] },
        { id: 'c', field: 'cf:42', op: 'is', values: [1] },
      ],
    });
    // The deleted field has no pill; the other two can still be removed one by one.
    assert.equal(document.querySelectorAll(`button[title="${filters.remove}"]`).length, 2);

    const clear = clearButton();
    assert.ok(clear);
    act(() => clear.click());
    assert.deepEqual(changes, [{ conditions: [] }]);
  });
});
