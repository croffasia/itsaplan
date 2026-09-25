import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Editor } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { JSDOM } from 'jsdom';
import { editorStarterKitOptions } from './MarkdownEditor';
import { IssueRef } from './issueRefDecorations';
import { refreshDecorations } from './refreshDecorations';

let dom: JSDOM;
let originals: Map<string, PropertyDescriptor | undefined>;

beforeEach(() => {
  dom = new JSDOM('<!doctype html><div></div>', { url: 'https://planner.test' });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    DOMParser: dom.window.DOMParser,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
  };
  originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
});

afterEach(() => {
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function mount(content: string, keys: () => string[], open: (href: string) => void = () => {}) {
  return new Editor({
    element: document.querySelector('div')!,
    editable: false,
    extensions: [
      StarterKit.configure(editorStarterKitOptions),
      Link.configure({ openOnClick: false, autolink: true }),
      IssueRef.configure({ keys, open, rich: () => false }),
      Markdown.configure({ html: true, linkify: true, breaks: true }),
    ],
    content,
  });
}

const links = (editor: Editor) => [...editor.view.dom.querySelectorAll('a.issue-ref')];

describe('issue identifiers in the editor', () => {
  it('links an identifier without changing the stored markdown', () => {
    const content = 'See MKT-42, mkt-7 and `MKT-9` in [MKT-3](https://example.com)';
    const editor = mount(content, () => ['MKT']);
    assert.deepEqual(
      links(editor).map((link) => [link.textContent, link.getAttribute('href')]),
      [['MKT-42', '/project/MKT/issue/42']],
    );
    assert.equal(editor.storage.markdown.getMarkdown(), content);
    editor.destroy();
  });

  it('links the keys that arrive after the editor was built', () => {
    let keys: string[] = [];
    const editor = mount('OPS-3 and MKT-42', () => keys);
    assert.equal(links(editor).length, 0);
    keys = ['MKT', 'OPS'];
    refreshDecorations(editor);
    assert.deepEqual(
      links(editor).map((link) => link.textContent),
      ['OPS-3', 'MKT-42'],
    );
    editor.destroy();
  });

  it('opens the issue on a plain click in read-only text', () => {
    const opened: string[] = [];
    const editor = mount(
      'See MKT-42',
      () => ['MKT'],
      (href) => opened.push(href),
    );
    const event = new dom.window.MouseEvent('click', { button: 0, cancelable: true });
    Object.defineProperty(event, 'target', { value: links(editor)[0] });
    const handled = editor.view.someProp('handleClick', (handle) => handle(editor.view, 5, event));
    assert.equal(handled, true);
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(opened, ['/project/MKT/issue/42']);
    editor.destroy();
  });
});
