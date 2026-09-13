import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Editor } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { JSDOM } from 'jsdom';
import {
  bareMarkdownUrls,
  editorLinkBlocks,
  linkDestination,
  previewUrl,
} from './linkPresentation';
import { createEditorLinkPresentation } from './editorLinkPresentation';
import { staticLinkBlocks } from './staticLinkPresentation';
import { renderMarkdown } from '@/lib/markdown';

let dom: JSDOM;
let originals: Map<string, PropertyDescriptor | undefined>;
let editor: Editor | undefined;

beforeEach(() => {
  dom = new JSDOM('<div id="editor"></div>', { url: 'https://planner.test' });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    DOMParser: dom.window.DOMParser,
    Node: dom.window.Node,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLAnchorElement: dom.window.HTMLAnchorElement,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: (fn: FrameRequestCallback) => setTimeout(fn, 0),
    cancelAnimationFrame: clearTimeout,
  };
  originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
});

afterEach(() => {
  editor?.destroy();
  editor = undefined;
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function makeEditor(source: string) {
  editor = new Editor({
    element: dom.window.document.getElementById('editor')!,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false }),
      Markdown.configure({ html: true, linkify: true, breaks: true }),
    ],
    content: source,
    editorProps: { handleScrollToSelection: () => true },
  });
  return editor;
}

describe('link presentation classification', () => {
  it('retains named labels and only compacts parsed standalone exact URLs', () => {
    const source = [
      'https://docs.example.com/API/Guide?token=A%2FB#Part-2',
      '<https://example.com/autolink>',
      '[installation steps](https://example.com/guide)',
      '[https://example.com/guide](https://other.example/path)',
      'Source: https://example.com/source',
      'https://example.com/first\nhttps://example.com/second',
      '`https://example.com/code`',
    ].join('\n\n');
    const urls = bareMarkdownUrls(source);
    assert.deepEqual(
      [...urls],
      ['https://docs.example.com/API/Guide?token=A%2FB#Part-2', 'https://example.com/autolink'],
    );
    const current = makeEditor(source);
    const blocks = editorLinkBlocks(current.state.doc, urls, 'https://planner.test');
    assert.equal(blocks.filter((block) => block.bare).length, 2);
    assert.equal(
      blocks.find((block) => block.links[0].label === 'installation steps')?.bare,
      false,
    );
    assert.equal(
      blocks.find((block) => block.links[0].url === 'https://other.example/path')?.links[0].label,
      'https://example.com/guide',
    );
    assert.equal(
      blocks.some((block) => block.links.some((link) => link.url.endsWith('/code'))),
      false,
    );
  });

  it('keeps ambiguous named URL labels and JSON without source in native text', () => {
    const source =
      'https://example.com/guide\n\n[https://example.com/guide](https://example.com/guide)';
    assert.equal(bareMarkdownUrls(source).size, 0);
    const current = makeEditor('https://example.com/guide');
    assert.equal(
      editorLinkBlocks(current.state.doc, new Set(), 'https://planner.test')[0].bare,
      false,
    );
  });

  it('retains authored URL spelling while deriving display-only host and path', () => {
    const url = 'https://www.docs.example.com/Case/A%2FB?signature=abc#Header';
    assert.deepEqual(linkDestination(url, 'https://planner.test'), {
      hostname: 'docs.example.com',
      pathname: '/Case/A%2FB',
    });
    assert.equal(
      previewUrl('/project/EX', 'https://planner.test')?.href,
      'https://planner.test/project/EX',
    );
    for (const unsafe of [
      'javascript:alert(1)',
      'mailto:a@example.com',
      'tel:123',
      'https://user:pass@example.com',
      '/media/file/raw',
      'https://example.com/file?download=1',
    ])
      assert.equal(previewUrl(unsafe, 'https://planner.test'), null);
  });

  it('keeps static sanitizer output and excludes code, images, downloads and tables', () => {
    const source =
      'https://example.com/one\n\n[human label](https://example.com/two)\n\n`https://example.com/code`';
    const html = renderMarkdown(source, { newTabLinks: true });
    const blocks = staticLinkBlocks(html, bareMarkdownUrls(source), 'https://planner.test');
    assert.equal(blocks.filter((block) => block.bare).length, 1);
    assert.equal(blocks.flatMap((block) => block.links).length, 2);
    assert.equal(blocks.flatMap((block) => block.links)[1].label, 'human label');
    const excluded = staticLinkBlocks(
      '<p><a href="https://example.com/file" download>File</a></p><table><tr><td><a href="https://example.com/table">Table</a></td></tr></table><p><a href="https://example.com/image"><img src="/image"></a></p>',
      new Set(),
      'https://planner.test',
    );
    assert.equal(excluded.flatMap((block) => block.links).length, 0);
  });
});

describe('ProseMirror reading decorations preserve the source', () => {
  it('adds and removes presentation without transactions, autosave, history or serialized UI', () => {
    const source =
      'https://example.com/guide?key=a%2Fb#Section\n\n[Named label](https://example.com/named)';
    const current = makeEditor(source);
    const json = current.getJSON();
    const markdown = current.storage.markdown.getMarkdown();
    let updates = 0;
    let transactions = 0;
    current.on('update', () => updates++);
    current.on('transaction', () => transactions++);
    const presentation = createEditorLinkPresentation(current, source, () => {});
    current.registerPlugin(presentation.plugin);
    for (const suspended of [false, true, false, true, false]) {
      presentation.configure({ enabled: true, compact: true, suspended });
      assert.deepEqual(current.getJSON(), json);
      assert.equal(current.storage.markdown.getMarkdown(), markdown);
    }
    assert.equal(current.view.dom.querySelectorAll('[data-link-widget]').length, 2);
    const copied = current.view.serializeForClipboard(
      current.state.doc.slice(0, current.state.doc.content.size),
    );
    assert.equal(copied.dom.querySelector('[data-link-widget]'), null);
    assert.equal(copied.dom.textContent, 'https://example.com/guide?key=a%2Fb#SectionNamed label');
    assert.equal(updates, 0);
    assert.equal(transactions, 0);
    assert.equal(current.can().undo(), false);
  });

  it('preserves selection and undo after composition-style content changes', () => {
    const source = 'https://example.com/guide';
    const current = makeEditor(source);
    const before = current.getJSON();
    const presentation = createEditorLinkPresentation(current, source, () => {});
    current.registerPlugin(presentation.plugin);
    presentation.configure({ enabled: true, compact: true, suspended: false });
    current.commands.setTextSelection(5);
    const selection = current.state.selection.toJSON();
    presentation.configure({ enabled: true, compact: true, suspended: true });
    assert.deepEqual(current.state.selection.toJSON(), selection);
    current.view.dispatch(current.state.tr.insertText('文字').setMeta('composition', 1));
    assert.notDeepEqual(current.getJSON(), before);
    presentation.configure({ enabled: true, compact: true, suspended: false });
    current.commands.undo();
    assert.deepEqual(current.getJSON(), before);
    assert.equal(current.storage.markdown.getMarkdown(), '<https://example.com/guide>');
  });

  it('keeps actual edits intact while recomputing presentation', () => {
    const source = 'https://example.com/guide';
    const current = makeEditor(source);
    const presentation = createEditorLinkPresentation(current, source, () => {});
    current.registerPlugin(presentation.plugin);
    presentation.configure({ enabled: true, compact: true, suspended: false });
    current.commands.insertContentAt(1, 'prefix ');
    assert.equal(current.view.dom.querySelectorAll('[data-link-widget]').length, 1);
    assert.equal(current.storage.markdown.getMarkdown().includes('prefix'), true);
  });
});
