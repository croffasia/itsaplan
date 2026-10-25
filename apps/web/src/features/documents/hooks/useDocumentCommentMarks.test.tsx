import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { Editor } from '@tiptap/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import type { DocumentComment, ProjectDocument } from '@/lib/api/endpoints/documents';
import { documentEditorExtensions } from '../components/DocumentMarkdownEditor';

type Hooks = typeof import('./useDocumentCollaboration') &
  typeof import('./useDocumentCommentMarks');

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'Element',
  'HTMLElement',
  'requestAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

const contentJson = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
};

const comment: DocumentComment = {
  documentVersion: 2,
  id: '00000000-0000-4000-8000-000000000001',
  documentId: 42,
  parentId: null,
  authorId: 'user-2',
  authorName: 'Ann',
  body: 'Is this right?',
  quote: 'Hello',
  from: 1,
  to: 6,
  orphaned: false,
  resolvedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const projectDocument: ProjectDocument = {
  id: 42,
  projectId: 7,
  parentId: null,
  title: 'Runbook',
  content: 'Hello world',
  contentJson,
  icon: null,
  metadata: {},
  fullWidth: false,
  isPrivate: false,
  isLocked: false,
  isFavorite: false,
  archivedAt: null,
  position: 0,
  version: 2,
  ownerUserId: 'user-2',
  createdByUserId: 'user-2',
  updatedByUserId: 'user-2',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

let dom: JSDOM;
let root: Root;
let editor: Editor;
let queryClient: QueryClient;
let hooks: Hooks;
let originalFetch: typeof fetch;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;
let commentsServed: () => void;
let opened: number;

// Wired the way DocumentEditor wires the two hooks: a member who may edit joins the
// collaborative session, a reader does not.
function Probe({ editable }: { editable: boolean }) {
  const collaboration = hooks.useDocumentCollaboration({
    editor,
    projectKey: 'SEKTA',
    document: projectDocument,
    userId: 'user-1',
    enabled: editable,
    onSaved: () => undefined,
  });
  hooks.useDocumentCommentMarks(
    editor,
    'SEKTA',
    42,
    () => (opened += 1),
    editable ? collaboration.version : projectDocument.version,
    collaboration.ready,
  );
  return null;
}

const marks = () => editor.view.dom.querySelectorAll('.document-comment-mark');

async function open(editable: boolean) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe editable={editable} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div><div id="editor"></div>', {
    url: 'https://plan.example.test',
  });
  dom.window.__ITSAPLAN_ENV__ = {
    apiUrl: 'https://api.example.test',
    privacyUrl: '',
    termsUrl: '',
  };
  dom.window.Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  dom.window.Range.prototype.getBoundingClientRect = () => new dom.window.DOMRect();
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    Node: { configurable: true, value: dom.window.Node },
    NodeFilter: { configurable: true, value: dom.window.NodeFilter },
    Element: { configurable: true, value: dom.window.Element },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    requestAnimationFrame: {
      configurable: true,
      value: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  hooks = {
    ...(await import('./useDocumentCollaboration')),
    ...(await import('./useDocumentCommentMarks')),
  };
  originalFetch = globalThis.fetch;
  opened = 0;
  // The comments arrive before the session opens, the order a page load usually has.
  const served = new Promise<void>((resolve) => (commentsServed = resolve));
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/comments')) {
      setTimeout(commentsServed, 10);
      return Response.json([comment]);
    }
    if (url.endsWith('/session')) {
      await served;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return Response.json({ documentId: 42, epoch: 'e1', version: 0, contentJson });
    }
    return Response.json({
      epoch: 'e1',
      version: 0,
      steps: [],
      hasMore: false,
      documentVersion: 2,
    });
  }) as typeof fetch;
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  editor = new Editor({
    element: document.querySelector('#editor') as HTMLElement,
    extensions: documentEditorExtensions({ placeholder: '', codeBlockLabel: '', tableLabel: '' }),
    content: contentJson,
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  act(() => root.unmount());
  editor.destroy();
  queryClient.clear();
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useDocumentCommentMarks', () => {
  it('keeps the marks of the open threads once the collaborative session loads', async () => {
    await open(true);

    assert.equal(marks().length, 1);
    assert.equal(marks()[0].textContent, 'Hello');
  });

  it('marks the threads for a reader, and opens the comments from a mark', async () => {
    await open(false);
    assert.equal(marks().length, 1);

    const handled = editor.view.someProp('handleClick', (handleClick) =>
      handleClick(editor.view, 2, { target: marks()[0] } as unknown as MouseEvent),
    );

    assert.equal(handled, true);
    assert.equal(opened, 1);
    // The click scrolls to the thread on the next frame.
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});
