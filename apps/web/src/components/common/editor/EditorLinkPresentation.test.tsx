import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Editor, EditorContent } from '@tiptap/react';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import * as auth from '@/lib/auth-client';
import common from '../../../../messages/en/common.json';

const spyOn = createRequire(import.meta.url)('bun:test').spyOn as (
  target: object,
  method: string,
) => {
  mockReturnValue(value: unknown): { mockRestore(): void };
  mockImplementation(fn: (...args: unknown[]) => unknown): { mockRestore(): void };
};

const source =
  'https://example.com/guide?key=A%2FB#part\n\nRead [the guide](https://example.com/other).';
let dom: JSDOM;
let root: Root;
let editor: Editor;
let client: QueryClient;
let originals: Map<string, PropertyDescriptor | undefined>;
let restoreSession: () => void;
let restoreConsole: () => void;
let originalFetch: typeof fetch;
let EditorLinkPreview: (typeof import('./EditorLinkPreview'))['default'];
let requests: string[];
let warnings: string[];

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

async function render({ compact = true, strict = true } = {}) {
  const content = (
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ common }}>
      <QueryClientProvider client={client}>
        <EditorContent editor={editor} />
        <EditorLinkPreview editor={editor} source={source} compact={compact} />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
  await act(() => root.render(strict ? <StrictMode>{content}</StrictMode> : content));
  await settle();
}

beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div><div id="editor"></div>', {
    url: 'https://planner.test',
    pretendToBeVisual: true,
  });
  dom.window.matchMedia = (media) => ({
    media,
    matches: true,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => true,
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    DOMParser: dom.window.DOMParser,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLAnchorElement: dom.window.HTMLAnchorElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent,
    PointerEvent: dom.window.MouseEvent,
    Image: dom.window.Image,
    IntersectionObserver: undefined,
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
  ({ default: EditorLinkPreview } = await import('./EditorLinkPreview'));
  const session = spyOn(auth, 'useSession').mockReturnValue({
    data: { user: { id: 'reader' } },
    isPending: false,
    error: null,
  } as ReturnType<typeof auth.useSession>);
  restoreSession = () => session.mockRestore();
  warnings = [];
  const logging = spyOn(console, 'error').mockImplementation((...args) =>
    warnings.push(args.join(' ')),
  );
  restoreConsole = () => logging.mockRestore();
  originalFetch = globalThis.fetch;
  requests = [];
  globalThis.fetch = (async (input) => {
    requests.push(String(input));
    return Response.json({
      url: 'https://example.com/guide',
      title: 'Fetched guide title',
      description: 'Description',
      siteName: 'Site',
      image: null,
    });
  }) as typeof fetch;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  editor = new Editor({
    element: document.getElementById('editor')!,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false }),
      Markdown.configure({ html: true, linkify: true, breaks: true }),
    ],
    content: source,
    editorProps: { handleScrollToSelection: () => true },
  });
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(() => root.unmount());
  editor.destroy();
  await settle();
  client.clear();
  globalThis.fetch = originalFetch;
  restoreSession();
  restoreConsole();
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

describe('mounted EditorContent link presentation', () => {
  it('loads only visible compact cards without changing the document or undo history', async () => {
    const observers: { show(): void; disconnected: boolean }[] = [];
    class Observer {
      disconnected = false;
      constructor(readonly callback: IntersectionObserverCallback) {
        observers.push(this);
      }
      observe() {}
      disconnect() {
        this.disconnected = true;
      }
      show() {
        this.callback(
          [
            {
              isIntersecting: true,
              intersectionRect: { width: 100, height: 64 },
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver,
        );
      }
    }
    Object.defineProperty(globalThis, 'IntersectionObserver', { value: Observer });
    const json = editor.getJSON();
    const markdown = editor.storage.markdown.getMarkdown();
    let updates = 0;
    editor.on('update', () => updates++);
    await render();
    assert.equal(requests.length, 0);
    const observer = observers.findLast((entry) => !entry.disconnected)!;
    await act(() => observer.show());
    await settle();
    assert.equal(requests.length, 1);
    assert.match(document.querySelector('[data-link-row]')!.textContent!, /Fetched guide title/);
    const trigger = document.querySelector<HTMLButtonElement>('[data-link-preview-control]')!;
    await act(() => trigger.click());
    await settle();
    assert.equal(requests.length, 1);
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.equal(updates, 0);
    assert.deepEqual(editor.getJSON(), json);
    assert.equal(editor.storage.markdown.getMarkdown(), markdown);
    assert.equal(editor.can().undo(), false);
  });

  it('disconnects visibility observation and cancels a pending preview when editing starts', async () => {
    let show!: () => void;
    let disconnected = false;
    let requestSignal: AbortSignal | null | undefined;
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      value: class {
        constructor(callback: IntersectionObserverCallback) {
          show = () =>
            callback(
              [
                {
                  isIntersecting: true,
                  intersectionRect: { width: 100, height: 64 },
                } as IntersectionObserverEntry,
              ],
              this as unknown as IntersectionObserver,
            );
        }
        observe() {}
        disconnect() {
          disconnected = true;
        }
      },
    });
    globalThis.fetch = (async (_input, init) => {
      requestSignal = init?.signal;
      return new Promise((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(requestSignal?.reason));
      });
    }) as typeof fetch;
    await render({ strict: false });
    await act(() => show());
    await settle();
    assert.equal(requestSignal?.aborted, false);
    await act(() => editor.view.dom.focus());
    await settle();
    assert.equal(disconnected, true);
    assert.equal(requestSignal?.aborted, true);
    assert.equal(document.querySelector('[data-link-row]'), null);
  });

  for (const type of ['pointerdown', 'mousedown']) {
    it(`keeps reading controls mounted when ${type} would focus the editing host`, async () => {
      await render();
      const json = editor.getJSON();
      const markdown = editor.storage.markdown.getMarkdown();
      let updates = 0;
      editor.on('update', () => updates++);
      const link = document.querySelector<HTMLAnchorElement>('[data-link-row]')!;
      const trigger = document.querySelector<HTMLButtonElement>('[data-link-preview-control]')!;
      const targets = [...link.querySelectorAll('span, svg'), trigger.querySelector('svg')!];
      for (const button of [0, 1, 2]) {
        for (const target of targets) {
          await act(() => {
            const press = new dom.window.MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              button,
            });
            if (target.dispatchEvent(press)) editor.view.dom.focus();
          });
          assert.equal(
            link.isConnected,
            true,
            `destination removed after pressing ${target.tagName}`,
          );
          assert.equal(trigger.isConnected, true);
          assert.notEqual(document.activeElement, editor.view.dom);
        }
      }
      for (const action of ['auxclick', 'contextmenu']) {
        const event = new dom.window.MouseEvent(action, { bubbles: true, cancelable: true });
        assert.equal(link.dispatchEvent(event), true);
      }
      const click = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
      let nativeActivation = false;
      link.addEventListener('click', (event) => {
        nativeActivation = !event.defaultPrevented;
        event.preventDefault();
      });
      await act(() => link.dispatchEvent(click));
      assert.equal(nativeActivation, true);
      assert.equal(link.href, 'https://example.com/guide?key=A%2FB#part');
      await act(() => trigger.click());
      await settle();
      assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
      assert.equal(updates, 0);
      assert.deepEqual(editor.getJSON(), json);
      assert.equal(editor.storage.markdown.getMarkdown(), markdown);
      assert.equal(editor.can().undo(), false);
    });
  }

  it('keeps keyboard focus and deliberate body editing available', async () => {
    await render();
    const link = document.querySelector<HTMLAnchorElement>('[data-link-row]')!;
    await act(() => link.focus());
    assert.equal(document.activeElement, link);
    assert.equal(link.isConnected, true);
    const text = editor.view.dom.querySelectorAll('p')[1]!;
    await act(() => {
      const press = new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true });
      assert.equal(text.dispatchEvent(press), true);
      editor.view.dom.focus();
    });
    assert.equal(document.querySelector('[data-link-row]'), null);
    assert.equal(document.activeElement, editor.view.dom);
  });

  it('mounts and changes capability presentation without lifecycle flushes or source updates', async () => {
    const json = editor.getJSON();
    const markdown = editor.storage.markdown.getMarkdown();
    let updates = 0;
    editor.on('update', () => updates++);
    await render();
    assert.equal(document.querySelectorAll('[data-link-row]').length, 1);
    assert.equal(document.querySelectorAll('[data-link-preview-control]').length, 2);
    assert.equal(requests.length, 0);
    await render({ compact: false });
    assert.equal(document.querySelectorAll('[data-link-row]').length, 0);
    assert.equal(document.querySelectorAll('[data-link-preview-control]').length, 2);
    await render();
    assert.equal(document.querySelectorAll('[data-link-row]').length, 1);
    assert.equal(
      warnings.some((warning) => /flushSync|lifecycle|Maximum update depth/.test(warning)),
      false,
      warnings.join('\n'),
    );
    assert.equal(updates, 0);
    assert.deepEqual(editor.getJSON(), json);
    assert.equal(editor.storage.markdown.getMarkdown(), markdown);
    assert.equal(editor.can().undo(), false);
  });

  it('opens a mounted widget preview and restores focus without editing the document', async () => {
    const json = editor.getJSON();
    const markdown = editor.storage.markdown.getMarkdown();
    let updates = 0;
    editor.on('update', () => updates++);
    await render({ strict: false });
    const trigger = document.querySelector<HTMLButtonElement>('[data-link-preview-control]')!;
    await act(() => trigger.click());
    await settle();
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
    assert.equal(requests.length, 1);
    assert.match(document.body.textContent!, /Fetched guide title/);
    const close = document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!;
    await act(() => close.click());
    await settle();
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.activeElement, trigger);
    assert.equal(updates, 0);
    assert.deepEqual(editor.getJSON(), json);
    assert.equal(editor.storage.markdown.getMarkdown(), markdown);
    assert.equal(
      warnings.some((warning) => /flushSync|lifecycle|Maximum update depth/.test(warning)),
      false,
      warnings.join('\n'),
    );
  });
});
