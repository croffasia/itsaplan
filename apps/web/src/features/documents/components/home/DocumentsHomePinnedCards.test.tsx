import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { ShellCtx, type ShellContext } from '@/context/shellContext';
import { RelativeTimeProvider } from '@/context/relativeTimeContext';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { qk } from '@/services/queryKeys';
import documents from '../../../../../messages/en/documents.json';
// Imported before the DOM globals exist: the API client then reads its origin from the
// process. The cards are imported after them, since Radix checks for a document on import.
import { useDocumentsQuery } from '../../services/documents.service';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'DocumentFragment',
  'Element',
  'HTMLElement',
  'HTMLButtonElement',
  'SVGElement',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'matchMedia',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

const page = (id: number, title: string, pinPosition: number | null) =>
  ({
    id,
    parentId: null,
    title,
    icon: null,
    isPrivate: false,
    isPinned: pinPosition !== null,
    pinPosition,
    position: id,
    updatedAt: '2026-11-01T00:00:00.000Z',
  }) as ProjectDocumentSummary;

const pages = () => [
  page(1, 'A', 1024),
  page(2, 'B', 2048),
  page(3, 'C', 3072),
  page(4, 'D', null),
];

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let failures: unknown[];
let pinRequests: { url: string; body: unknown }[];
// Answers the pending pin request with a status, and sets the list the server answers next:
// null when the list cannot be read either.
let answerPin: (status: number, list: ProjectDocumentSummary[] | null) => void;
let serverList: ProjectDocumentSummary[] | null;
let originals: Map<string, PropertyDescriptor | undefined>;

async function render(permissions: Record<string, Record<string, boolean>>) {
  const project = {
    project: { id: 1, ref: 'MKT', teamId: 1 },
    viewer: { role: 'member', teamRole: 'member', via: 'member' },
    permissions,
  };
  client.setQueryData(qk.documents('MKT'), pages());
  const { default: DocumentsHomePinned } = await import('./DocumentsHomePinned');
  function Home() {
    const list = useDocumentsQuery('MKT').data ?? [];
    return <DocumentsHomePinned projectKey="MKT" documents={list} />;
  }
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ documents }}>
          <RelativeTimeProvider>
            <ShellCtx.Provider value={{ project } as unknown as ShellContext}>
              <Home />
            </ShellCtx.Provider>
          </RelativeTimeProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
}

const order = () =>
  [...document.querySelectorAll('article')].map(
    (card) => card.querySelector('[dir="auto"]')?.textContent,
  );

const menuTrigger = (title: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"]')].find(
    (button) => button.getAttribute('aria-label') === `Actions for ${title}`,
  );

// Opens the menu of a card and returns its items by label.
async function openMenu(title: string): Promise<Map<string, HTMLElement>> {
  await act(async () => {
    menuTrigger(title)!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
  });
  return new Map(
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((item) => [
      item.textContent ?? '',
      item,
    ]),
  );
}

// Lets the answered request, its rollback or refetch, and the render after them run.
async function settle() {
  await act(async () => {
    while (client.isMutating() > 0 || client.isFetching() > 0) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  });
}

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });
  for (const name of replacedGlobals) {
    if (name in dom.window)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
  }
  const matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: matchMedia });
  pinRequests = [];
  failures = [];
  serverList = pages();
  Object.defineProperties(globalThis, {
    matchMedia: { configurable: true, value: matchMedia },
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    requestAnimationFrame: {
      configurable: true,
      value: dom.window.requestAnimationFrame.bind(dom.window),
    },
    cancelAnimationFrame: {
      configurable: true,
      value: dom.window.cancelAnimationFrame.bind(dom.window),
    },
    ResizeObserver: {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    },
    fetch: {
      configurable: true,
      value: (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const unavailable = () => Response.json({ error: 'Unavailable' }, { status: 503 });
        if (!url.endsWith('/pin')) {
          return Promise.resolve(serverList ? Response.json(serverList) : unavailable());
        }
        pinRequests.push({ url, body: JSON.parse(String(init?.body)) });
        return new Promise<Response>((resolve) => {
          answerPin = (status, list) => {
            serverList = list;
            resolve(status === 200 ? Response.json({ isPinned: true }) : unavailable());
          };
        });
      },
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  client = new QueryClient({
    // Stands in for the app's cache, which toasts every failed write.
    mutationCache: new MutationCache({ onError: (error) => void failures.push(error) }),
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('DocumentsHomePinnedCards', () => {
  it('moves a card one place from its menu at once and names its new neighbours', async () => {
    await render({ documents: { read: true, edit: true } });
    assert.deepEqual(order(), ['A', 'B', 'C']);

    const items = await openMenu('A');
    assert.equal(items.get(documents.moveUp)?.getAttribute('aria-disabled'), 'true');
    await act(async () => items.get(documents.moveDown)!.click());

    assert.deepEqual(order(), ['B', 'A', 'C']);
    assert.deepEqual(pinRequests, [
      {
        url: 'http://api.test/projects/MKT/documents/1/pin',
        body: { isPinned: true, afterId: 2, beforeId: 3 },
      },
    ]);
    answerPin(200, [page(1, 'A', 2048), page(2, 'B', 1024), page(3, 'C', 3072)]);
    await settle();
    assert.deepEqual(order(), ['B', 'A', 'C']);
    assert.deepEqual(failures, []);
  });

  it('puts the cards back in their order when the move fails, with no list to reload', async () => {
    await render({ documents: { read: true, edit: true } });

    const items = await openMenu('C');
    assert.equal(items.get(documents.moveDown)?.getAttribute('aria-disabled'), 'true');
    await act(async () => items.get(documents.moveUp)!.click());
    assert.deepEqual(order(), ['A', 'C', 'B']);
    assert.deepEqual(pinRequests[0]?.body, { isPinned: true, afterId: 1, beforeId: 2 });

    answerPin(503, null);
    await settle();
    assert.deepEqual(order(), ['A', 'B', 'C']);
    assert.equal(failures.length, 1);
  });

  it('shows a member who may not pin the order with no menu and no drag', async () => {
    await render({ documents: { read: true } });

    assert.deepEqual(order(), ['A', 'B', 'C']);
    assert.equal(document.querySelectorAll('button[aria-haspopup="menu"]').length, 0);
    assert.equal(document.querySelectorAll('article.cursor-grab').length, 0);
  });
});
