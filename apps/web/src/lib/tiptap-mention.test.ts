import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { JSDOM } from 'jsdom';
import { refreshDecorations } from '@/components/common/editor/refreshDecorations';
import { Mention } from './tiptap-mention';

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

describe('mentions of the viewer', () => {
  it('marks only the viewer, including once the session arrives', () => {
    let self = '';
    const editor = new Editor({
      element: document.querySelector('div')!,
      editable: false,
      extensions: [
        StarterKit.configure({ link: false }),
        Mention.configure({ items: () => [], self: () => self }),
        Markdown.configure({ html: true, linkify: true, breaks: true }),
      ],
      content: 'Hi @Ana, see @bob',
    });
    const marked = () =>
      [...editor.view.dom.querySelectorAll('.mention-self')].map((node) => node.textContent);
    assert.equal(editor.view.dom.querySelectorAll('.mention').length, 2);
    assert.deepEqual(marked(), []);
    self = 'ana';
    refreshDecorations(editor);
    assert.deepEqual(marked(), ['@Ana']);
    assert.equal(editor.storage.markdown.getMarkdown(), 'Hi @Ana, see @bob');
    editor.destroy();
  });
});
