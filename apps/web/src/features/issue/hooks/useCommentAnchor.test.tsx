import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, StrictMode } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import * as auth from '@/lib/auth-client';
import { type FeedSlice, useFeedQuery } from '../services/comments.service';
import { type ActivityFeedView, useActivityFeedView } from './useActivityFeedView';
import { useCommentAnchor } from './useCommentAnchor';

const spyOn = createRequire(import.meta.url)('bun:test').spyOn as (
  target: object,
  method: string,
) => { mockReturnValue(value: unknown): { mockRestore(): void } };

const ISSUE_ID = 1;
const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'localStorage',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

interface ObserverHarness {
  target: Element | null;
  disconnected: boolean;
  trigger: () => void;
}

// The entry ids of each page the feed api serves, by the tab's filter.
let feeds: Record<string, number[][]>;
let failingPage: number | null;
// A page the api answers only once the test calls releaseHeldPage, so the test acts
// while that page is in flight.
let heldPage: number | null;
let releaseHeldPage: () => void;
// Every feed page asked for, as "<filter>:<page>".
let requests: string[];
let scrolls: string[];
let observers: ObserverHarness[];
let view: ActivityFeedView;

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let restoreSession: () => void;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function serve(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(String(input));
  if (url.pathname === '/account/preferences') {
    return Response.json({ issueActivityView: 'flat' });
  }
  assert.equal(url.pathname, `/issues/${ISSUE_ID}/feed`);
  const filter = url.searchParams.get('filter') ?? 'all';
  const cursor = url.searchParams.get('cursor');
  const page = cursor ? (JSON.parse(cursor) as { id: number }).id : 0;
  requests.push(`${filter}:${page}`);
  const held = page === heldPage && new Promise<void>((resolve) => (releaseHeldPage = resolve));
  // A page arrives after the commit that starts its fetch, as it does over the network.
  await sleep(5);
  await held;
  if (page === failingPage) return Response.json({ error: 'Server error' }, { status: 500 });
  const pages = feeds[filter] ?? [[]];
  return Response.json({
    items: pages[page].map((id) => ({ id, kind: 'comment' })),
    nextCursor: page + 1 < pages.length ? { ts: '2026-01-01T00:00:00.000Z', id: page + 1 } : null,
  });
}

// The activity log as IssueActivityFeed wires it: the real feed view and feed query,
// with a bare element per loaded entry in place of the comment threads.
function Feed({ commentId }: { commentId: number | null }) {
  view = useActivityFeedView();
  const highlightedId = useCommentAnchor(ISSUE_ID, view, commentId);
  return (
    <div data-testid="scroller" style={{ overflowY: 'auto' }}>
      <div>
        <p data-testid="state">{`${view.tab}:${highlightedId ?? ''}`}</p>
        {view.ready && <FeedEntries slice={view.slice} />}
      </div>
    </div>
  );
}

function FeedEntries({ slice }: { slice: FeedSlice }) {
  const feed = useFeedQuery(ISSUE_ID, slice);
  return (feed.data?.pages ?? [])
    .flatMap((page) => page.items)
    .map((item) => <div key={item.id} id={`feed-item-${item.id}`} />);
}

async function render(commentId: number) {
  window.history.replaceState(null, '', `/acme/issue/TEST-1#comment-${commentId}`);
  await act(async () =>
    root.render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <NextIntlClientProvider locale="en" messages={{}} timeZone="UTC">
            <Feed commentId={commentId} />
          </NextIntlClientProvider>
        </QueryClientProvider>
      </StrictMode>,
    ),
  );
}

async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await act(() => sleep(10));
  assert.ok(check(), 'the condition never held');
}

const tabAndHighlightedId = () => document.querySelector('[data-testid="state"]')?.textContent;
const anchoredId = () => window.history.state?.__itsaplanCommentAnchor;

beforeEach(async () => {
  feeds = {};
  failingPage = null;
  heldPage = null;
  requests = [];
  scrolls = [];
  observers = [];
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/acme/issue/TEST-1',
    pretendToBeVisual: true,
  });
  dom.window.HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
    scrolls.push(this.id);
  };

  class TestResizeObserver {
    private readonly harness: ObserverHarness;

    constructor(callback: ResizeObserverCallback) {
      this.harness = {
        target: null,
        disconnected: false,
        trigger: () => callback([], this as unknown as ResizeObserver),
      };
      observers.push(this.harness);
    }

    observe(target: Element) {
      this.harness.target = target;
    }

    unobserve() {}

    disconnect() {
      this.harness.disconnected = true;
    }
  }

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    localStorage: { configurable: true, value: dom.window.localStorage },
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    requestAnimationFrame: {
      configurable: true,
      value: dom.window.requestAnimationFrame.bind(dom.window),
    },
    cancelAnimationFrame: {
      configurable: true,
      value: dom.window.cancelAnimationFrame.bind(dom.window),
    },
    ResizeObserver: { configurable: true, value: TestResizeObserver },
    fetch: { configurable: true, value: serve },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const session = spyOn(auth, 'useSession').mockReturnValue({
    data: { user: { id: 'reader' } },
    isPending: false,
    error: null,
  });
  restoreSession = () => session.mockRestore();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  restoreSession();
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useCommentAnchor', () => {
  it('loads pages until the comment renders, then scrolls to it once and highlights it', async () => {
    feeds.all = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    await render(5);
    await until(() => tabAndHighlightedId() === 'all:5');

    assert.deepEqual(requests, ['all:0', 'all:1', 'all:2']);
    assert.deepEqual(scrolls, ['feed-item-5']);
    assert.equal(anchoredId(), 5);

    // Content loading above the comment moves it, so a resize aligns it again until
    // the reader scrolls.
    const observer = observers.at(-1)!;
    assert.equal(observer.target, document.querySelector('[data-testid="scroller"] > div'));
    observer.trigger();
    assert.deepEqual(scrolls, ['feed-item-5', 'feed-item-5']);
    act(() => window.dispatchEvent(new dom.window.Event('wheel')));
    assert.equal(observer.disconnected, true);
  });

  it('gives up after the last page when the comment is not in the feed', async () => {
    feeds.all = [
      [1, 2],
      [3, 4],
    ];
    await render(9);
    await until(() => anchoredId() === 9);
    await act(() => sleep(100));

    assert.deepEqual(requests, ['all:0', 'all:1']);
    assert.deepEqual(scrolls, []);
    assert.equal(tabAndHighlightedId(), 'all:');
  });

  it('stops after a page fails instead of asking for it again', async () => {
    feeds.all = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    failingPage = 1;
    await render(5);
    await until(() => anchoredId() === 5);
    await act(() => sleep(100));

    assert.deepEqual(requests, ['all:0', 'all:1']);
    assert.deepEqual(scrolls, []);
    assert.equal(tabAndHighlightedId(), 'all:');
  });

  it('stops when the reader scrolls before the comment is found', async () => {
    feeds.all = [[1], [2], [3]];
    heldPage = 1;
    await render(3);
    await until(() => requests.includes('all:1'));
    act(() => window.dispatchEvent(new dom.window.Event('wheel')));
    releaseHeldPage();
    await act(() => sleep(100));

    assert.deepEqual(requests, ['all:0', 'all:1']);
    assert.deepEqual(scrolls, []);
    assert.equal(anchoredId(), 3);
  });

  it('switches a saved History tab to All without saving the switch', async () => {
    localStorage.setItem('issue-activity-tab', 'history');
    feeds.history = [[10]];
    feeds.all = [[1, 2]];
    await render(2);
    await until(() => tabAndHighlightedId() === 'all:2');

    assert.deepEqual(scrolls, ['feed-item-2']);
    assert.deepEqual(
      requests.filter((request) => request.startsWith('all')),
      ['all:0'],
    );
    assert.equal(localStorage.getItem('issue-activity-tab'), 'history');
  });

  it('leaves the reader on a tab without comments they pick during the search', async () => {
    localStorage.setItem('issue-activity-tab', 'history');
    feeds.history = [[10]];
    feeds.all = [[1], [2], [3]];
    heldPage = 1;
    await render(3);
    await until(() => requests.includes('all:1'));
    act(() => view.setTab('history'));
    releaseHeldPage();
    await act(() => sleep(100));

    assert.equal(tabAndHighlightedId(), 'history:');
    assert.deepEqual(scrolls, []);
    assert.equal(anchoredId(), 3);
  });
});
