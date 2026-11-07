import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import { useOtherProjectIssueSearch } from './issues.service';
import { qk } from './queryKeys';
import type { CrossProjectIssueHit } from '@/lib/api/endpoints/issues';

let root: Root;
let dom: JSDOM;
let client: QueryClient;
let result: ReturnType<typeof useOtherProjectIssueSearch>;
let requests: URL[];
let held: Promise<void> | null;
let descriptors: Map<string, PropertyDescriptor | undefined>;

function hit(id: number, projectKey: string): CrossProjectIssueHit {
  return {
    id,
    sequenceNumber: id,
    identifier: `${projectKey}-${id}`,
    title: 'Launch',
    columnId: 1,
    typeId: null,
    initiativeId: null,
    cycleId: null,
    parentId: null,
    assigneeUserId: null,
    delegateUserId: null,
    priority: null,
    dueDate: null,
    labelIds: [],
    archived: false,
    projectId: projectKey === 'MKT' ? 1 : 2,
    projectRef: `eng.${projectKey}`,
    projectKey,
    projectName: projectKey,
    teamName: 'Engineering',
  };
}

function Harness({
  q,
  current,
  enabled,
}: {
  q: string;
  current: { key: string | null; id: number | null };
  enabled: boolean;
}) {
  result = useOtherProjectIssueSearch(q, current, { enabled });
  return null;
}

async function render(
  current: { key: string | null; id: number | null },
  q = 'launch',
  enabled = true,
) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness q={q} current={current} enabled={enabled} />
      </QueryClientProvider>,
    );
  });
  // Let the request resolve and its result render.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
}

beforeEach(async () => {
  descriptors = new Map(
    ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  dom = new JSDOM('<div id="root"></div>');
  requests = [];
  held = null;
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
    fetch: {
      configurable: true,
      value: async (input: string | URL) => {
        requests.push(new URL(String(input)));
        await held;
        return Response.json([hit(3, 'OPS')]);
      },
    },
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  act(() => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

it('waits for the current project to load before searching the other projects', async () => {
  // A search from a page with no project, which includes MKT's issues.
  client.setQueryData(qk.issueSearchAll('launch', null), [hit(1, 'MKT'), hit(3, 'OPS')]);

  await render({ key: 'eng.MKT', id: null });
  assert.equal(result.hits.length, 0);
  assert.equal(requests.length, 0);

  let release!: () => void;
  held = new Promise((resolve) => (release = resolve));
  await render({ key: 'eng.MKT', id: 1 });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.searchParams.get('excludeProjectId'), '1');
  assert.equal(result.fetching, true);
  assert.equal(result.hits.length, 0);

  await act(async () => {
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  assert.deepEqual(
    result.hits.map((h) => h.identifier),
    ['OPS-3'],
  );
});

it('searches every project when no project is open', async () => {
  await render({ key: null, id: null });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.searchParams.has('excludeProjectId'), false);
  assert.deepEqual(
    result.hits.map((h) => h.identifier),
    ['OPS-3'],
  );
});

it('keeps the previous hits while a changed term is searched', async () => {
  await render({ key: 'eng.MKT', id: 1 });
  held = new Promise(() => {});
  await render({ key: 'eng.MKT', id: 1 }, 'launc');
  assert.equal(result.fetching, true);
  assert.deepEqual(
    result.hits.map((h) => h.identifier),
    ['OPS-3'],
  );
});

it('shows no cached hits while disabled, as when the search is narrowed to the project', async () => {
  client.setQueryData(qk.issueSearchAll('launch', 1), [hit(3, 'OPS')]);

  await render({ key: 'eng.MKT', id: 1 }, 'launch', false);
  assert.equal(requests.length, 0);
  assert.equal(result.hits.length, 0);
});

it('stops reporting a search in flight once disabled', async () => {
  held = new Promise(() => {});
  await render({ key: 'eng.MKT', id: 1 });
  assert.equal(result.fetching, true);

  await render({ key: 'eng.MKT', id: 1 }, 'launch', false);
  assert.equal(result.fetching, false);
  assert.equal(result.hits.length, 0);
});
