import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { JSDOM } from 'jsdom';
import { ResizableImage } from './tiptap-image';

let dom: JSDOM;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

beforeEach(() => {
  originalGlobalDescriptors = new Map(
    ['window', 'document', 'navigator', 'DOMParser', 'Node', 'Element', 'HTMLElement'].map(
      (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)],
    ),
  );
  dom = new JSDOM('<!doctype html><div></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    DOMParser: { configurable: true, value: dom.window.DOMParser },
    Node: { configurable: true, value: dom.window.Node },
    Element: { configurable: true, value: dom.window.Element },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  });
});

afterEach(() => {
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

function imageEditor(content: string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ link: false }),
      ResizableImage,
      Markdown.configure({ html: true, linkify: true, breaks: true }),
    ],
    content,
  });
}

function imageAttrs(editor: Editor): Record<string, unknown> {
  const image = editor.getJSON().content?.flatMap((node) => node.content ?? [node])[0];
  assert.equal(image?.type, 'image');
  return image?.attrs ?? {};
}

describe('ResizableImage style attribute', () => {
  it('keeps only the sizing of a raw <img style> in the text', () => {
    const editor = imageEditor(
      '<img src="/a.png" alt="a" style="position:fixed;inset:0;width:320px;height:100vh;z-index:9999">',
    );
    assert.equal(imageAttrs(editor).style, 'width: 320px');
    assert.doesNotMatch(editor.getHTML(), /position|inset|z-index|100vh/);
    assert.equal(
      editor.storage.markdown.getMarkdown(),
      '<img src="/a.png" alt="a" style="width: 320px">',
    );
    editor.destroy();
  });

  it('drops a style with nothing allowed in it', () => {
    const editor = imageEditor('<img src="/a.png" alt="a" style="position:fixed;inset:0">');
    assert.equal(imageAttrs(editor).style, null);
    assert.equal(editor.storage.markdown.getMarkdown(), '![a](/a.png)');
    editor.destroy();
  });

  it('keeps the max-width an embed carries', () => {
    const editor = imageEditor('<img src="/a.png" alt="a" style="max-width:50%">');
    assert.equal(imageAttrs(editor).style, 'max-width: 50%');
    assert.equal(
      editor.storage.markdown.getMarkdown(),
      '<img src="/a.png" alt="a" style="max-width: 50%">',
    );
    editor.destroy();
  });

  it('keeps the width the resizer stores', () => {
    const editor = imageEditor('<img src="/a.png" alt="a" width="240">');
    assert.equal(imageAttrs(editor).width, 240);
    assert.equal(editor.storage.markdown.getMarkdown(), '<img src="/a.png" alt="a" width="240">');
    editor.destroy();
  });
});
