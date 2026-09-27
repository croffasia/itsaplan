import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import * as auth from '@/lib/auth-client';
import common from '../../../../messages/en/common.json';
import LinkBlockControls from './LinkBlockControls';

type SessionSnapshot = ReturnType<typeof auth.useSession>;
const { spyOn } = createRequire(import.meta.url)('bun:test') as {
  spyOn(
    target: object,
    method: string,
  ): {
    mockImplementation(fn: () => SessionSnapshot): { mockRestore(): void };
  };
};

class Observer {
  static instances: Observer[] = [];
  element?: Element;
  disconnected = false;
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options: IntersectionObserverInit,
  ) {
    Observer.instances.push(this);
  }
  observe(element: Element) {
    this.element = element;
  }
  disconnect() {
    this.disconnected = true;
  }
  emit(visible: boolean, width = 100, height = 64) {
    this.callback(
      [
        {
          target: this.element,
          isIntersecting: visible,
          intersectionRect: { width, height },
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;
let originalFetch: typeof fetch;
let restoreSession: () => void;
let session: SessionSnapshot;
const listeners = new Set<() => void>();
let requests: { url: URL; signal?: AbortSignal | null }[];
let respond: (url: URL, signal?: AbortSignal | null) => Promise<Response>;
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
const preview = (title: string) => ({
  url: 'https://example.test/',
  title,
  description: 'Description',
  image: null,
  siteName: 'Example',
});

function setSession(userId: string | null, isPending = false, sessionId = `session-${userId}`) {
  session = {
    data: userId ? { user: { id: userId }, session: { id: sessionId } } : null,
    isPending,
    error: null,
  } as SessionSnapshot;
  for (const listener of listeners) listener();
}

async function render(urls = ['https://example.test/guide'], compact = true) {
  await act(() =>
    root.render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ common }}>
        <QueryClientProvider client={client}>
          {urls.map((url, index) => (
            <LinkBlockControls
              key={index}
              links={[{ url, label: url }]}
              compact={compact}
              onPreview={() => {}}
            />
          ))}
        </QueryClientProvider>
      </NextIntlClientProvider>,
    ),
  );
  await settle();
}

async function intersect(observer: Observer, visible: boolean, width?: number, height?: number) {
  await act(() => observer.emit(visible, width, height));
  await settle();
}

beforeEach(() => {
  dom = new JSDOM('<div id="root"></div>', { url: 'https://planner.test' });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    IntersectionObserver: Observer,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  Observer.instances = [];
  originalFetch = globalThis.fetch;
  requests = [];
  respond = async () => Response.json(preview('Visible card title'));
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, signal: init?.signal });
    return respond(url, init?.signal);
  }) as typeof fetch;
  const mock = spyOn(auth, 'useSession').mockImplementation(function useTestSession() {
    return useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => session,
      () => session,
    );
  });
  restoreSession = () => mock.mockRestore();
  setSession('reader');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 120_000 } } });
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(() => root.unmount());
  client.clear();
  restoreSession();
  listeners.clear();
  globalThis.fetch = originalFetch;
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

describe('visible compact link cards', () => {
  it('requests metadata only after a positive viewport intersection', async () => {
    await render();
    const observer = Observer.instances[0]!;
    assert.equal(observer.options.rootMargin, '0px');
    assert.equal(requests.length, 0);
    await intersect(observer, false);
    await intersect(observer, true, 0, 64);
    await intersect(observer, true, 100, 0);
    assert.equal(requests.length, 0);
    await intersect(observer, true);
    assert.equal(requests.length, 1);
    assert.match(document.body.textContent!, /Visible card title/);
    assert.equal(requests[0]!.url.searchParams.get('url'), 'https://example.test/guide');
  });

  it('deduplicates normalized URLs and reuses external metadata after scrolling back', async () => {
    await render(['https://EXAMPLE.test:443/guide', 'https://example.test/guide']);
    await act(() => {
      for (const observer of Observer.instances) observer.emit(true);
    });
    await settle();
    assert.equal(requests.length, 1);
    assert.equal(document.querySelectorAll('[data-link-row]').length, 2);
    assert.equal(document.body.textContent!.split('Visible card title').length - 1, 2);
    await intersect(Observer.instances[0]!, false);
    await intersect(Observer.instances[0]!, true);
    assert.equal(requests.length, 1);
  });

  it('keeps inline controls and browsers without an observer on demand', async () => {
    await render(undefined, false);
    assert.equal(Observer.instances.length, 0);
    assert.equal(requests.length, 0);
    Object.defineProperty(globalThis, 'IntersectionObserver', { value: undefined });
    await render();
    assert.equal(requests.length, 0);
    assert.ok(document.querySelector('[data-link-preview-control]'));
  });

  it('refreshes expired external metadata when the card becomes visible again', async () => {
    const url = 'https://example.test/guide';
    client.setQueryData(['link-preview', 'reader', url], preview('Cached title'));
    await render([url]);
    await intersect(Observer.instances[0]!, true);
    assert.equal(requests.length, 0);
    assert.match(document.body.textContent!, /Cached title/);
    await intersect(Observer.instances[0]!, false);
    client.setQueryData(['link-preview', 'reader', url], preview('Cached title'), {
      updatedAt: Date.now() - 300_001,
    });
    await intersect(Observer.instances[0]!, true);
    assert.equal(requests.length, 1);
    assert.match(document.body.textContent!, /Visible card title/);
  });

  it('retries an empty external response after its short cache lifetime', async () => {
    const url = 'https://example.test/guide';
    client.setQueryData(
      ['link-preview', 'reader', url],
      { url, title: null, description: null, image: null, siteName: null },
      { updatedAt: Date.now() - 15_001 },
    );
    await render([url]);
    assert.equal(requests.length, 0);
    await intersect(Observer.instances[0]!, true);
    assert.equal(requests.length, 1);
    assert.match(document.body.textContent!, /Visible card title/);
  });

  it('ignores hidden cards and callbacks delivered after a capability change', async () => {
    await render();
    const observer = Observer.instances[0]!;
    (observer.element as HTMLElement).style.visibility = 'hidden';
    await intersect(observer, true);
    assert.equal(requests.length, 0);
    (observer.element as HTMLElement).style.visibility = 'visible';
    await render(undefined, false);
    assert.equal(observer.disconnected, true);
    await intersect(observer, true);
    assert.equal(requests.length, 0);
    await render();
    assert.equal(requests.length, 0);
    await intersect(Observer.instances.at(-1)!, true);
    assert.equal(requests.length, 1);
  });

  it('cancels requests when a card leaves view or its URL changes', async () => {
    respond = (_url, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason));
      });
    await render();
    await intersect(Observer.instances[0]!, true);
    await intersect(Observer.instances[0]!, false);
    assert.equal(requests[0]!.signal?.aborted, true);
    await intersect(Observer.instances[0]!, true);
    await render(['https://example.test/replacement']);
    assert.equal(requests[1]!.signal?.aborted, true);
    assert.equal(requests.length, 2);
    await intersect(Observer.instances.at(-1)!, true);
    assert.equal(requests[2]!.url.searchParams.get('url'), 'https://example.test/replacement');
    await render([]);
    assert.equal(requests[2]!.signal?.aborted, true);
  });

  it('hides cached internal details until access is revalidated on each visibility change', async () => {
    const url = 'https://planner.test/project/PRIVATE';
    client.setQueryData(
      ['link-preview', 'reader', url, 'session-reader'],
      preview('Old private title'),
    );
    let resolve!: (response: Response) => void;
    respond = () => new Promise((done) => (resolve = done));
    await render(['/project/PRIVATE']);
    assert.doesNotMatch(document.body.textContent!, /Old private title/);
    await intersect(Observer.instances[0]!, true);
    assert.equal(requests[0]!.url.pathname, '/projects/PRIVATE');
    assert.doesNotMatch(document.body.textContent!, /Old private title/);
    await act(() =>
      resolve(
        Response.json({ project: { key: 'PRIVATE', name: 'Private title', description: '' } }),
      ),
    );
    await settle();
    assert.match(document.body.textContent!, /Private title/);
    await intersect(Observer.instances[0]!, false);
    await intersect(Observer.instances[0]!, true);
    assert.equal(requests.length, 2);
    assert.doesNotMatch(document.body.textContent!, /Private title/);
    await act(() => resolve(Response.json({ error: 'Forbidden' }, { status: 403 })));
    await settle();
    assert.doesNotMatch(document.body.textContent!, /Private title/);
    assert.ok(document.querySelector('a[href="/project/PRIVATE"]'));
  });

  it('hides metadata for pending, changed and signed-out sessions', async () => {
    await render();
    await intersect(Observer.instances[0]!, true);
    assert.match(document.body.textContent!, /Visible card title/);
    await act(() => setSession('reader', true));
    assert.doesNotMatch(document.body.textContent!, /Visible card title/);
    respond = () => new Promise(() => {});
    await act(() => setSession('other-reader'));
    await settle();
    assert.equal(requests.length, 2);
    assert.doesNotMatch(document.body.textContent!, /Visible card title/);
    await act(() => setSession(null));
    assert.doesNotMatch(document.body.textContent!, /Visible card title/);
    assert.equal(requests[1]!.signal?.aborted, true);
  });

  it('revalidates internal access when the same account receives a new session', async () => {
    respond = async () =>
      Response.json({ project: { key: 'PRIVATE', name: 'Private title', description: '' } });
    await render(['/project/PRIVATE']);
    await intersect(Observer.instances[0]!, true);
    assert.match(document.body.textContent!, /Private title/);
    let resolve!: (response: Response) => void;
    respond = () => new Promise((done) => (resolve = done));
    await act(() => setSession('reader', false, 'replacement-session'));
    await settle();
    assert.equal(requests.length, 2);
    assert.doesNotMatch(document.body.textContent!, /Private title/);
    await act(() => resolve(Response.json({ error: 'Forbidden' }, { status: 403 })));
    await settle();
    assert.doesNotMatch(document.body.textContent!, /Private title/);
  });
});
