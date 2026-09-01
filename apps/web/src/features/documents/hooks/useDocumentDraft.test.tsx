import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import type { ProjectDocument } from '@/lib/api';

type UseDocumentDraft = (typeof import('./useDocumentDraft'))['useDocumentDraft'];
type DocumentDraftController = ReturnType<UseDocumentDraft>;
type Api = (typeof import('@/lib/api'))['api'];

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let queryClient: QueryClient;
let useDocumentDraft: UseDocumentDraft;
let api: Api;
let originalUpdateDocument: Api['updateDocument'];
let controller: DocumentDraftController | null;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

function projectDocument(version: number, content: string): ProjectDocument {
  return {
    id: 42,
    projectId: 7,
    parentId: null,
    title: 'Runbook',
    content,
    contentJson: null,
    icon: null,
    metadata: {},
    fullWidth: false,
    isPrivate: false,
    isLocked: false,
    isFavorite: false,
    archivedAt: null,
    position: 0,
    version,
    ownerUserId: 'user-1',
    createdByUserId: 'user-1',
    updatedByUserId: 'user-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function Probe({
  document,
  editable,
  onController = (value) => {
    controller = value;
  },
}: {
  document: ProjectDocument;
  editable: boolean;
  onController?: (value: DocumentDraftController) => void;
}) {
  const value = useDocumentDraft({
    projectKey: 'SEKTA',
    document,
    editable,
    userId: 'user-1',
  });
  onController(value);
  return null;
}

function renderInto(
  targetRoot: Root,
  document: ProjectDocument,
  editable: boolean,
  onController?: (value: DocumentDraftController) => void,
) {
  act(() =>
    targetRoot.render(
      <QueryClientProvider client={queryClient}>
        <Probe document={document} editable={editable} onController={onController} />
      </QueryClientProvider>,
    ),
  );
}

function render(document: ProjectDocument, editable = true) {
  renderInto(root, document, editable);
  assert.ok(controller);
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://plan.example.test' });
  dom.window.__ITSAPLAN_ENV__ = {
    apiUrl: 'https://api.example.test',
    privacyUrl: '',
    termsUrl: '',
  };
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });

  ({ useDocumentDraft } = await import('./useDocumentDraft'));
  ({ api } = await import('@/lib/api'));
  originalUpdateDocument = api.updateDocument;
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  controller = null;

  const { createRoot } = await import('react-dom/client');
  const rootElement = document.querySelector('#root');
  assert.ok(rootElement);
  root = createRoot(rootElement);
});

afterEach(() => {
  api.updateDocument = originalUpdateDocument;
  act(() => root.unmount());
  queryClient.clear();
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useDocumentDraft', () => {
  it('adopts a newer remote version when the editor is clean', () => {
    render(projectDocument(1, 'Initial'));
    const previousRevision = controller!.editorRevision;

    render(projectDocument(2, 'Changed elsewhere'));

    assert.equal(controller!.content, 'Changed elsewhere');
    assert.equal(controller!.version, 2);
    assert.equal(controller!.saveState, 'saved');
    assert.equal(controller!.editorRevision, previousRevision + 1);
  });

  it('preserves a local draft and enters conflict on a newer remote version', () => {
    render(projectDocument(1, 'Initial'));
    act(() => controller!.setContent('Local draft', { type: 'doc', content: [] }));

    render(projectDocument(2, 'Changed elsewhere'));

    assert.equal(controller!.content, 'Local draft');
    assert.equal(controller!.version, 1);
    assert.equal(controller!.dirty, true);
    assert.equal(controller!.saveState, 'conflict');
  });

  it('refreshes a read-only view without requiring an editor save', () => {
    render(projectDocument(1, 'Initial'), false);

    render(projectDocument(2, 'Read-only refresh'), false);

    assert.equal(controller!.content, 'Read-only refresh');
    assert.equal(controller!.version, 2);
    assert.equal(controller!.saveState, 'saved');
  });

  it('rebases edits made during an in-flight save before a remount', async () => {
    const first = projectDocument(1, 'Server copy');
    render(first);

    let resolveUpdate!: (document: ProjectDocument) => void;
    const update = new Promise<ProjectDocument>((resolve) => {
      resolveUpdate = resolve;
    });
    api.updateDocument = () => update;

    act(() => controller!.setContent('Snapshot A', { type: 'doc', content: [] }));
    let savePromise!: Promise<ProjectDocument | null>;
    act(() => {
      savePromise = controller!.save();
    });
    act(() => controller!.setContent('Newer draft B', { type: 'doc', content: [] }));

    const storageKey = 'itsaplan:document-draft:user-1:SEKTA:42';
    assert.equal(JSON.parse(window.localStorage.getItem(storageKey)!).baseVersion, 1);

    // Navigation may unmount the editor while its request is still in flight.
    // The success path must rebase the recovery draft without relying on a
    // mounted component or a follow-up React effect.
    act(() => root.unmount());
    resolveUpdate(projectDocument(2, 'Snapshot A'));
    await savePromise;

    const rebased = JSON.parse(window.localStorage.getItem(storageKey)!);
    assert.deepEqual(
      { title: rebased.title, content: rebased.content, baseVersion: rebased.baseVersion },
      { title: 'Runbook', content: 'Newer draft B', baseVersion: 2 },
    );
    assert.equal(typeof rebased.writerId, 'string');

    const { createRoot } = await import('react-dom/client');
    const rootElement = document.querySelector('#root');
    assert.ok(rootElement);
    root = createRoot(rootElement);
    controller = null;
    render(projectDocument(2, 'Snapshot A'));

    assert.equal(controller!.content, 'Newer draft B');
    assert.equal(controller!.dirty, true);
    assert.equal(controller!.saveState, 'saved');
  });

  it("does not rebase another tab's recovery draft", async () => {
    render(projectDocument(1, 'Server copy'));

    let resolveUpdate!: (document: ProjectDocument) => void;
    const update = new Promise<ProjectDocument>((resolve) => {
      resolveUpdate = resolve;
    });
    api.updateDocument = () => update;

    act(() => controller!.setContent('Saved by tab A', { type: 'doc', content: [] }));
    let savePromise!: Promise<ProjectDocument | null>;
    act(() => {
      savePromise = controller!.save();
    });

    const storageKey = 'itsaplan:document-draft:user-1:SEKTA:42';
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        title: 'Runbook',
        content: 'Draft from tab B',
        baseVersion: 1,
        writerId: 'tab-b',
      }),
    );

    act(() => root.unmount());
    resolveUpdate(projectDocument(2, 'Saved by tab A'));
    await savePromise;

    assert.deepEqual(JSON.parse(window.localStorage.getItem(storageKey)!), {
      title: 'Runbook',
      content: 'Draft from tab B',
      baseVersion: 1,
      writerId: 'tab-b',
    });

    const { createRoot } = await import('react-dom/client');
    const rootElement = document.querySelector('#root');
    assert.ok(rootElement);
    root = createRoot(rootElement);
  });

  it("does not delete another mounted tab's recovery draft after saving", async () => {
    render(projectDocument(1, 'Server copy'));
    const tabA = controller!;

    const tabBElement = document.createElement('div');
    document.body.appendChild(tabBElement);
    const { createRoot } = await import('react-dom/client');
    const tabBRoot = createRoot(tabBElement);
    const tabB: { current: DocumentDraftController | null } = { current: null };
    renderInto(tabBRoot, projectDocument(1, 'Server copy'), true, (value) => {
      tabB.current = value;
    });
    assert.ok(tabB.current);

    let resolveUpdate!: (document: ProjectDocument) => void;
    const update = new Promise<ProjectDocument>((resolve) => {
      resolveUpdate = resolve;
    });
    api.updateDocument = () => update;

    act(() => tabA.setContent('Saved by tab A', { type: 'doc', content: [] }));
    let savePromise!: Promise<ProjectDocument | null>;
    act(() => {
      savePromise = tabA.save();
    });
    act(() => tabB.current!.setContent('Newer draft from tab B', { type: 'doc', content: [] }));

    const storageKey = 'itsaplan:document-draft:user-1:SEKTA:42';
    const tabBDraft = JSON.parse(window.localStorage.getItem(storageKey)!);
    assert.equal(tabBDraft.content, 'Newer draft from tab B');
    assert.equal(typeof tabBDraft.writerId, 'string');

    await act(async () => {
      resolveUpdate(projectDocument(2, 'Saved by tab A'));
      await savePromise;
    });

    assert.deepEqual(JSON.parse(window.localStorage.getItem(storageKey)!), tabBDraft);

    renderInto(tabBRoot, projectDocument(2, 'Saved by tab A'), true, (value) => {
      tabB.current = value;
    });
    assert.equal(tabB.current!.content, 'Newer draft from tab B');
    assert.equal(tabB.current!.dirty, true);
    assert.equal(tabB.current!.saveState, 'conflict');

    act(() => tabBRoot.unmount());
    tabBElement.remove();
  });
});
