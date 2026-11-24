import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import * as auth from '@/lib/auth-client';
import { useDocumentTreeExpanded } from './useDocumentTreeExpanded';
import { useDocumentTreeReveal } from './useDocumentTreeReveal';

const spyOn = createRequire(import.meta.url)('bun:test').spyOn as (
  target: object,
  method: string,
) => { mockImplementation(value: () => unknown): { mockRestore(): void } };

const replacedGlobals = ['window', 'document', 'Event', 'IS_REACT_ACT_ENVIRONMENT'] as const;
const page = (id: number, parentId: number | null) => ({ id, parentId }) as ProjectDocumentSummary;
const pages = [page(1, null), page(2, 1), page(3, 2), page(4, null)];

let dom: JSDOM;
let root: Root;
let signedIn: boolean;
let restoreSession: () => void;
let originals: Map<string, PropertyDescriptor | undefined>;
let tree: ReturnType<typeof useDocumentTreeExpanded>;

function Probe({
  projectKey = 'DOC',
  activeId = null,
  documents = pages,
}: {
  projectKey?: string;
  activeId?: number | null;
  documents?: ProjectDocumentSummary[];
}) {
  tree = useDocumentTreeExpanded(projectKey);
  useDocumentTreeReveal(activeId, documents, tree.expand);
  return null;
}

const render = (props: Parameters<typeof Probe>[0] = {}) =>
  act(async () => root.render(<Probe {...props} />));
const expanded = () => [...tree.expanded];

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/' });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    Event: { configurable: true, value: dom.window.Event },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  signedIn = true;
  const session = spyOn(auth, 'useSession').mockImplementation(() => ({
    data: signedIn ? { user: { id: 'reader' } } : null,
  }));
  restoreSession = () => session.mockRestore();
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  await render();
  await act(async () => tree.collapseAll());
});

afterEach(async () => {
  await act(async () => root.unmount());
  restoreSession();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useDocumentTreeExpanded', () => {
  it('starts collapsed over the state an older version stored', async () => {
    dom.window.sessionStorage.setItem(
      'docs-nav:reader:OLD:tree',
      JSON.stringify({ collapsed: [1] }),
    );
    await render({ projectKey: 'OLD' });
    assert.deepEqual(expanded(), []);
  });

  it('keeps the branches per project in sessionStorage', async () => {
    await act(async () => tree.toggle(1));
    await act(async () => tree.expand([1, 2]));
    assert.deepEqual(expanded(), [1, 2]);
    assert.deepEqual(JSON.parse(dom.window.sessionStorage.getItem('docs-nav:reader:DOC:tree')!), {
      expanded: [1, 2],
    });

    await render({ projectKey: 'OTHER' });
    assert.deepEqual(expanded(), []);
    await render();
    await act(async () => tree.toggle(1));
    assert.deepEqual(expanded(), [2]);
    await act(async () => tree.collapseAll());
    assert.deepEqual(expanded(), []);
  });
});

describe('useDocumentTreeReveal', () => {
  it('expands the branches above the open page once', async () => {
    await render({ activeId: 3 });
    assert.deepEqual(expanded(), [1, 2]);
    await act(async () => tree.collapseAll());
    await render({ activeId: 3, documents: [...pages] });
    assert.deepEqual(expanded(), []);
  });

  it('expands the new branch when the open page moves', async () => {
    await render({ activeId: 4 });
    assert.deepEqual(expanded(), []);
    await render({ activeId: 4, documents: [page(1, null), page(4, 1)] });
    assert.deepEqual(expanded(), [1]);
  });

  it('waits for the session', async () => {
    signedIn = false;
    await render({ activeId: 3 });
    assert.deepEqual(expanded(), []);
    signedIn = true;
    await render({ activeId: 3 });
    assert.deepEqual(expanded(), [1, 2]);
  });
});
