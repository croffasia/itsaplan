import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { Editor } from '@tiptap/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import type { ProjectDocument } from '@/lib/api/endpoints/documents';
import { documentEditorExtensions } from '../components/DocumentMarkdownEditor';

type UseDocumentCollaboration =
  (typeof import('./useDocumentCollaboration'))['useDocumentCollaboration'];

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'HTMLElement',
  'requestAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let editor: Editor;
let queryClient: QueryClient;
let useDocumentCollaboration: UseDocumentCollaboration;
let originalFetch: typeof fetch;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;
let sessionSeed: Record<string, unknown> | null;
let sessionRejected: boolean;
let collaboration: ReturnType<UseDocumentCollaboration>;

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

function Probe({ document }: { document: ProjectDocument }) {
  collaboration = useDocumentCollaboration({
    editor,
    projectKey: 'SEKTA',
    document,
    userId: 'user-1',
    enabled: true,
    onSaved: () => undefined,
  });
  return null;
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
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    requestAnimationFrame: {
      configurable: true,
      value: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });

  ({ useDocumentCollaboration } = await import('./useDocumentCollaboration'));
  originalFetch = globalThis.fetch;
  sessionSeed = null;
  sessionRejected = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/session')) {
      if (sessionRejected) {
        return Response.json(
          { error: 'contentJson contains an unsupported node.' },
          { status: 400 },
        );
      }
      sessionSeed = JSON.parse(String(init?.body)).contentJson;
      return Response.json({ documentId: 42, epoch: 'e1', version: 0, contentJson: sessionSeed });
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
    extensions: documentEditorExtensions({
      placeholder: '',
      codeBlockLabel: 'Code',
      tableLabel: 'Table',
    }),
    content: 'Old requirement',
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

describe('useDocumentCollaboration', () => {
  it('seeds a session from the document Markdown, not from a stale editor body', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe document={projectDocument(2, 'New requirement')} />
        </QueryClientProvider>,
      );
    });

    assert.ok(sessionSeed);
    assert.match(JSON.stringify(sessionSeed), /New requirement/);
    assert.doesNotMatch(JSON.stringify(sessionSeed), /Old requirement/);
    assert.equal(editor.getText(), 'New requirement');
    assert.equal(collaboration.openFailed, false);
  });

  it('reports a session the api refused to open', async () => {
    sessionRejected = true;
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe document={projectDocument(2, 'New requirement')} />
        </QueryClientProvider>,
      );
    });

    assert.equal(collaboration.ready, false);
    assert.equal(collaboration.openFailed, true);
  });

  it('offers the stored changes for export when one of them no longer applies', async () => {
    window.sessionStorage.setItem(
      'document-steps:user-1:SEKTA:42',
      JSON.stringify({
        epoch: 'e1',
        version: 0,
        clientId: 'client-1',
        base: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              attrs: { blockId: 'saved' },
              content: [{ type: 'text', text: 'Saved' }],
            },
          ],
        },
        steps: [
          {
            stepType: 'replace',
            from: 6,
            to: 6,
            slice: { content: [{ type: 'text', text: '!' }] },
          },
          {
            stepType: 'replaceAround',
            from: 20,
            to: 22,
            gapFrom: 21,
            gapTo: 21,
            insert: 1,
            slice: { content: [{ type: 'paragraph' }] },
            structure: true,
          },
        ],
      }),
    );
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe document={projectDocument(2, 'Saved')} />
        </QueryClientProvider>,
      );
    });

    assert.equal(collaboration.recoveryConflict, true);
    assert.equal(collaboration.status, 'conflict');
    assert.equal(editor.getText(), 'Saved!');
  });
});
