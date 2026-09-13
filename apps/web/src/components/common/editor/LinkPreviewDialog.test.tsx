import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, StrictMode, useSyncExternalStore } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import common from '../../../../messages/en/common.json';
import filters from '../../../../messages/en/filters.json';
import display from '../../../../messages/en/display.json';
import type { LinkPreviewItem } from './LinkPreviewDialog';
import { linkPreviewDestination } from './linkPreviewDestination';

let dom: JSDOM;
let root: Root;
let queryClient: QueryClient;
let LinkPreviewDialog: (typeof import('./LinkPreviewDialog'))['default'];
let originalFetch: typeof fetch;
type SessionSnapshot = ReturnType<(typeof import('@/lib/auth-client'))['useSession']>;
// Loading the test helper without Bun's globals preserves the web app's fetch type.
const { spyOn } = createRequire(import.meta.url)('bun:test') as {
  spyOn: (
    target: object,
    method: string,
  ) => {
    mockImplementation: (implementation: () => SessionSnapshot) => { mockRestore: () => void };
  };
};
let sessionSnapshot: SessionSnapshot;
let restoreSession: () => void;
const sessionListeners = new Set<() => void>();
let originals: Map<string, PropertyDescriptor | undefined>;
let calls: { url: URL; signal: AbortSignal | null | undefined }[];
let respond: (url: URL, signal?: AbortSignal | null) => Promise<Response>;
let sessionUser: string | null;
let closeCount: number;
let trigger: HTMLElement;
let container: HTMLElement;

const wait = (ms = 20) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
const preview = (title: string) => ({
  url: 'https://example.test',
  title,
  description: 'Description',
  image: null,
  siteName: 'Metadata site name',
});
const sessionData = () =>
  sessionUser ? { user: { id: sessionUser }, session: { id: `session-${sessionUser}` } } : null;

function setSession(userId: string | null, pending = false) {
  sessionUser = userId;
  sessionSnapshot = { data: sessionData(), isPending: pending, error: null } as SessionSnapshot;
  for (const listener of sessionListeners) listener();
}

function subscribeSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

async function render(links: LinkPreviewItem[], strict = false) {
  await act(() => {
    const dialog = (
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ common, filters, display }}>
        <QueryClientProvider client={queryClient}>
          <LinkPreviewDialog
            links={links}
            trigger={trigger}
            container={container}
            onClose={() => closeCount++}
          />
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
    root.render(strict ? <StrictMode>{dialog}</StrictMode> : dialog);
  });
  await wait();
}

function button(label: string) {
  const result = [...document.querySelectorAll('button')].find(
    (element) =>
      element.textContent?.trim() === label || element.getAttribute('aria-label') === label,
  );
  assert.ok(result, `Missing button: ${label}`);
  return result;
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.click();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(async () => {
  dom = new JSDOM(
    '<div id="root"></div><div id="content"><button id="trigger">Preview</button></div>',
    {
      url: 'https://planner.test',
      pretendToBeVisual: true,
    },
  );
  dom.window.__ITSAPLAN_ENV__ = { apiUrl: 'http://api.test', privacyUrl: '', termsUrl: '' };
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    CustomEvent: dom.window.CustomEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  originalFetch = globalThis.fetch;
  calls = [];
  respond = async () => Response.json(preview('Resolved title'));
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/get-session')) return Response.json(sessionData());
    calls.push({ url, signal: init?.signal });
    return respond(url, init?.signal);
  }) as typeof fetch;
  const auth = await import('@/lib/auth-client');
  // better-auth captures fetch at module import, which can precede this fixture in a combined run.
  const sessionSpy = spyOn(auth, 'useSession').mockImplementation(function useTestSession() {
    return useSyncExternalStore(
      subscribeSession,
      () => sessionSnapshot,
      () => sessionSnapshot,
    );
  });
  restoreSession = () => sessionSpy.mockRestore();
  setSession('reader-1');
  ({ default: LinkPreviewDialog } = await import('./LinkPreviewDialog'));
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  closeCount = 0;
  trigger = document.getElementById('trigger')!;
  container = document.getElementById('content')!;
  trigger.focus();
});

afterEach(async () => {
  await act(() => root.unmount());
  await wait(5);
  queryClient.clear();
  restoreSession();
  sessionListeners.clear();
  globalThis.fetch = originalFetch;
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

describe('explicit link preview dialog', () => {
  it('stays open during the development Strict Mode mount check', async () => {
    await render(
      [
        { url: 'https://first.test', label: 'First' },
        { url: 'https://second.test', label: 'Second' },
      ],
      true,
    );
    assert.equal(closeCount, 0);
    assert.ok(document.querySelector('[role="dialog"]'));
    await click(button('Close'));
    assert.equal(closeCount, 1);
  });
  it('fetches only the selected destination and returns focus to its list row', async () => {
    await render([
      { url: 'https://first.test/a', label: 'First link' },
      { url: 'https://second.test/b?token=exact#part', label: 'Second link' },
    ]);
    assert.equal(calls.length, 0);
    const rows = [...document.querySelectorAll('li button')] as HTMLButtonElement[];
    assert.equal(document.activeElement, rows[0]);
    await click(rows[1]!);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url.searchParams.get('url'), 'https://second.test/b?token=exact#part');
    assert.equal(document.activeElement?.textContent?.trim(), 'Open link');
    assert.match(document.body.textContent!, /second.test/);
    await click(button('Back to links'));
    assert.equal(calls.length, 1);
    assert.match(document.activeElement?.textContent ?? '', /Second link/);
  });

  it('keeps focused actions outside the scrolling metadata and URL', async () => {
    const url = 'https://github.com/croffasia/itsaplan?tab=readme#installation';
    queryClient.setQueryData(['link-preview', 'reader-1', url], {
      ...preview('A long repository title with installation, deployment and configuration details'),
      description: 'Repository documentation and installation instructions. '.repeat(12),
      image: 'data:image/png;base64,iVBORw0KGgo=',
    });
    await render([{ url, label: url, onEdit: () => {} }]);
    const scrollArea = document.querySelector('h3')!.closest('.overflow-y-auto')!;
    const open = document.querySelector<HTMLAnchorElement>('a[data-link-preview-primary]')!;
    assert.ok(scrollArea);
    assert.ok(scrollArea.querySelector('img'));
    assert.ok([...scrollArea.querySelectorAll('p')].some((element) => element.textContent === url));
    assert.equal(scrollArea.contains(open), false);
    assert.equal(scrollArea.contains(button('Copy link')), false);
    assert.equal(scrollArea.contains(button('Edit link')), false);
    assert.equal(document.activeElement, open);
  });

  it('uses destinations for bare URL headings and preserves author-written labels', async () => {
    const links = [
      {
        url: 'https://github.com/project/repo?tab=readme#part',
        label: 'https://github.com/project/repo?tab=readme#part',
      },
      { url: 'https://GITHUB.COM/project/other', label: 'https://github.com/project/other' },
      { url: '/project/DEMO', label: '/project/DEMO' },
      { url: '/project/PLAN', label: 'The project plan' },
    ];
    respond = (_url, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason));
      });
    await render(links);
    const titles = ['github.com', 'github.com', 'ItsAPlan page', 'The project plan'];
    for (const [index, title] of titles.entries()) {
      const rows = [...document.querySelectorAll<HTMLButtonElement>('li button')];
      await click(rows[index]!);
      assert.equal(document.querySelector('h3')!.textContent, title);
      assert.ok(
        [...document.querySelectorAll('p')].some(
          (element) => element.textContent === links[index]!.url,
        ),
      );
      await click(button('Back to links'));
    }
  });

  it('keeps the authored URL for opening and copying and reports clipboard failure', async () => {
    const url = '/project/DEMO?token=A%2FB#exact';
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          copied = value;
        },
      },
    });
    respond = async () =>
      Response.json({ project: { key: 'DEMO', name: 'Project', description: '' } });
    await render([{ url, label: 'Project label' }]);
    const open = document.querySelector<HTMLAnchorElement>('a[data-link-preview-primary]')!;
    assert.equal(open.getAttribute('href'), url);
    assert.equal(open.target, '_blank');
    assert.equal(open.rel, 'noopener noreferrer');
    assert.equal(open.getAttribute('referrerpolicy'), 'no-referrer');
    assert.equal(calls[0]!.url.pathname, '/projects/DEMO');
    await click(button('Copy link'));
    assert.equal(copied, url);
    assert.ok(button('Copied'));
    await wait(2020);
    assert.ok(button('Copy link'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    await click(button('Copy link'));
    assert.match(document.querySelector('[role="status"]')!.textContent!, /Could not copy/);
    assert.ok(button('Copy link'));
    assert.ok(
      [...document.querySelectorAll('p')].some(
        (element) => element.textContent === url && element.dir === 'ltr',
      ),
    );
  });

  it('dismisses on Escape, aborts the pending query and restores focus without scrolling', async () => {
    let aborted = false;
    respond = (_url, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          aborted = true;
          reject(signal.reason);
        });
      });
    await render([{ url: 'https://pending.test', label: 'Pending' }]);
    assert.equal(calls.length, 1);
    assert.match(document.body.textContent!, /Loading preview/);
    let focusOptions: FocusOptions | undefined;
    const focus = trigger.focus.bind(trigger);
    trigger.focus = (options) => {
      focusOptions = options;
      focus(options);
    };
    await act(() =>
      document.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    await wait();
    assert.equal(closeCount, 1);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(aborted, true);
    assert.equal(document.activeElement, trigger);
    assert.equal(focusOptions?.preventScroll, true);
  });

  it('focuses the content container when the trigger is gone', async () => {
    await render([{ url: 'https://example.test', label: 'Example' }]);
    trigger.remove();
    await click(button('Close'));
    assert.equal(closeCount, 1);
    assert.equal(document.activeElement, container);
    assert.equal(container.hasAttribute('tabindex'), false);
  });

  it('revalidates cached internal metadata and hides permission failures', async () => {
    const url = 'https://planner.test/project/PRIVATE';
    queryClient.setQueryData(
      ['link-preview', 'reader-1', url],
      preview('Previously permitted title'),
    );
    let resolve!: (response: Response) => void;
    respond = () =>
      new Promise((done) => {
        resolve = done;
      });
    await render([{ url, label: 'Private link' }]);
    assert.equal(calls.length, 1);
    assert.doesNotMatch(document.body.textContent!, /Previously permitted title/);
    await act(() => resolve(Response.json({ error: 'Forbidden' }, { status: 403 })));
    await wait();
    assert.doesNotMatch(document.body.textContent!, /Previously permitted title|Try again/);
    assert.match(document.body.textContent!, /unavailable or you do not have access/);
    assert.ok(document.querySelector('a[data-link-preview-primary]'));
  });

  it('reuses fresh external cache but clears it when the account or session changes', async () => {
    const url = 'https://example.test/cached';
    queryClient.setQueryData(['link-preview', 'reader-1', url], preview('Account one title'));
    await render([{ url, label: 'External link' }]);
    assert.equal(calls.length, 0);
    assert.match(document.body.textContent!, /Account one title/);
    respond = () => new Promise(() => {});
    await act(() => setSession('reader-2'));
    await wait();
    assert.doesNotMatch(document.body.textContent!, /Account one title/);
    assert.equal(calls.length, 1);
    await act(() => setSession(null));
    assert.doesNotMatch(document.body.textContent!, /Account one title/);
  });

  it('retries a network failure only on request and omits the action for 404', async () => {
    respond = async () => {
      throw new TypeError('Network failed');
    };
    await render([{ url: 'https://network.test', label: 'Network' }]);
    assert.equal(calls.length, 1);
    await wait(30);
    assert.equal(calls.length, 1);
    respond = async () => Response.json({ error: 'Not found' }, { status: 404 });
    await click(button('Try again'));
    assert.equal(calls.length, 2);
    assert.doesNotMatch(document.body.textContent!, /Try again/);
  });

  it('offers editing only for a mapped occurrence and runs it after dismissal', async () => {
    let edited = false;
    await render([
      {
        url: 'https://example.test',
        label: 'Example',
        onEdit: () => {
          assert.equal(document.querySelector('[role="dialog"]'), null);
          assert.equal(closeCount, 1);
          edited = true;
        },
      },
    ]);
    await click(button('Edit link'));
    assert.equal(edited, true);
  });

  it('normalizes preview requests while rejecting unsupported and credential-bearing destinations', () => {
    assert.equal(
      linkPreviewDestination('/project/A?x=%2F#part', 'https://planner.test')?.href,
      'https://planner.test/project/A?x=%2F#part',
    );
    for (const url of [
      'javascript:alert(1)',
      'mailto:user@example.test',
      'https://user:secret@example.test',
      'http://[',
    ])
      assert.equal(linkPreviewDestination(url), null);
  });
});
