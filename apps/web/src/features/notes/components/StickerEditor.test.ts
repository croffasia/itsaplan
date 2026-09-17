import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Editor } from '@tiptap/core';
import { JSDOM } from 'jsdom';
import { stickerEditorExtensions } from '../utils/stickerEditorExtensions';
import { createLinkKeyboardHandlers } from '@/components/common/editor/linkKeyboardHandlers';
import {
  openLinkOnAuxClick,
  openLinkOnModifierClick,
} from '@/components/common/editor/modifierClickLink';

let dom: JSDOM;
let editor: Editor | undefined;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;
let opened: unknown[][];
let updates: number;

beforeEach(() => {
  originalGlobalDescriptors = new Map(
    [
      'window',
      'document',
      'navigator',
      'DOMParser',
      'Node',
      'Element',
      'HTMLElement',
      'HTMLAnchorElement',
      'getComputedStyle',
    ].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div></div>', {
    url: 'https://itsaplan.example/projects/API/notes',
  });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    DOMParser: { configurable: true, value: dom.window.DOMParser },
    Node: { configurable: true, value: dom.window.Node },
    Element: { configurable: true, value: dom.window.Element },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    HTMLAnchorElement: { configurable: true, value: dom.window.HTMLAnchorElement },
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
  });
  opened = [];
  updates = 0;
  dom.window.open = (...args: Parameters<typeof window.open>) => {
    opened.push(args);
    return null;
  };
});

afterEach(() => {
  editor?.destroy();
  editor = undefined;
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

function createEditor(content = '[Documentation](/projects/API/work-items)') {
  editor = new Editor({
    element: dom.window.document.querySelector('div')!,
    extensions: stickerEditorExtensions('Write a note'),
    content,
    editable: true,
    onUpdate: () => updates++,
    editorProps: {
      handleClick(view, _pos, event) {
        return openLinkOnModifierClick(event, view.dom);
      },
      handleDOMEvents: createLinkKeyboardHandlers(),
      handleScrollToSelection: () => true,
    },
  });
  return editor;
}

function mouseEvent(target: Element, type: string, options: MouseEventInit = {}) {
  const event = new dom.window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

describe('StickerEditor links', () => {
  it('registers one link extension and renders keyboard-reachable internal destinations', () => {
    const editor = createEditor();
    assert.equal(
      editor.extensionManager.extensions.filter((extension) => extension.name === 'link').length,
      1,
    );
    const link = editor.view.dom.querySelector('a')!;
    assert.equal(link.getAttribute('href'), '/projects/API/work-items');
    assert.equal(link.getAttribute('tabindex'), '0');
    assert.equal(link.classList.contains('cursor-pointer'), true);
    assert.equal(
      editor.storage.markdown.getMarkdown(),
      '[Documentation](/projects/API/work-items)',
    );
  });

  it('preserves relative destinations in markdown and rendered links', () => {
    const editor = createEditor('[Relative](../work-items) and [Section](#details)');
    assert.deepEqual(
      [...editor.view.dom.querySelectorAll('a')].map((link) => link.getAttribute('href')),
      ['../work-items', '#details'],
    );
    assert.equal(
      editor.storage.markdown.getMarkdown(),
      '[Relative](../work-items) and [Section](#details)',
    );
  });

  it('opens an ordinary link click while the note is editable', () => {
    const editor = createEditor();
    const markdown = editor.storage.markdown.getMarkdown();
    const link = editor.view.dom.querySelector('a')!;
    const click = mouseEvent(link, 'click');
    assert.equal(openLinkOnModifierClick(click, editor.view.dom), false);
    const handled = editor.view.someProp('handleClick', (handler) =>
      handler(editor.view, 1, click),
    );
    assert.equal(handled, true);
    assert.equal(editor.isEditable, true);
    assert.equal(opened.length, 1);
    assert.equal(
      new URL(String(opened[0]?.[0]), dom.window.location.href).href,
      'https://itsaplan.example/projects/API/work-items',
    );
    assert.equal(opened[0]?.[1], '_blank');
    assert.equal(editor.storage.markdown.getMarkdown(), markdown);
    assert.equal(updates, 0);
  });

  it('opens real rendered links with Ctrl, Cmd, or the middle mouse button', () => {
    const editor = createEditor();
    const link = editor.view.dom.querySelector('a')!;
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      const click = mouseEvent(link, 'click', modifier);
      assert.equal(
        editor.view.someProp('handleClick', (handler) => handler(editor.view, 1, click)),
        true,
      );
      assert.equal(click.defaultPrevented, true);
    }
    const middle = mouseEvent(link, 'auxclick', { button: 1 });
    assert.equal(middle.defaultPrevented, true);
    assert.deepEqual(
      opened,
      Array.from({ length: 3 }, () => [
        'https://itsaplan.example/projects/API/work-items',
        '_blank',
        'noopener,noreferrer',
      ]),
    );
  });

  it('does not open plain text or unsafe protocols through either click handler', () => {
    const editor = createEditor('Ordinary text\n\n[Documentation](https://example.com)');
    const paragraph = editor.view.dom.querySelector('p')!;
    const plain = mouseEvent(paragraph, 'click', { ctrlKey: true });
    assert.equal(openLinkOnModifierClick(plain, editor.view.dom), false);
    assert.equal(
      openLinkOnAuxClick(mouseEvent(paragraph, 'auxclick', { button: 1 }), editor.view.dom),
      false,
    );
    const link = editor.view.dom.querySelector('a')!;
    for (const href of ['javascript:alert(1)', 'data:text/html,unsafe', 'file:///etc/passwd']) {
      link.setAttribute('href', href);
      const click = mouseEvent(link, 'click', { ctrlKey: true });
      assert.equal(openLinkOnModifierClick(click, editor.view.dom), false);
      assert.equal(
        openLinkOnAuxClick(mouseEvent(link, 'auxclick', { button: 1 }), editor.view.dom),
        false,
      );
    }
    assert.deepEqual(opened, []);
  });

  it('does not render unsafe markdown destinations as usable links', () => {
    const editor = createEditor(
      '[Script](javascript:alert%281%29) [Data](data:text/html;base64,PHNjcmlwdD4=) [File](file:///etc/passwd) [Safe](https://example.com/docs)',
    );
    assert.deepEqual(
      [...editor.view.dom.querySelectorAll('a[href]')].map((link) => link.getAttribute('href')),
      ['https://example.com/docs'],
    );
    assert.deepEqual(opened, []);
  });

  it('opens Enter on a keyboard-focused link', () => {
    const editor = createEditor();
    const link = editor.view.dom.querySelector('a')!;
    link.focus();
    assert.equal(dom.window.document.activeElement, link);
    const enter = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(enter);
    assert.equal(enter.defaultPrevented, true);
    assert.deepEqual(opened, [
      ['https://itsaplan.example/projects/API/work-items', '_blank', 'noopener,noreferrer'],
    ]);
  });

  it('retains keyboard link focus when the browser delivers Enter to the editing host', () => {
    const editor = createEditor();
    const link = editor.view.dom.querySelector('a')!;
    link.focus();
    editor.view.dom.focus();
    const enter = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    editor.view.dom.dispatchEvent(enter);
    assert.equal(enter.defaultPrevented, true);
    assert.equal(opened.length, 1);
  });

  it('does not open a link when pointer editing focus returns Enter to the host', () => {
    const editor = createEditor();
    const link = editor.view.dom.querySelector('a')!;
    mouseEvent(link, 'pointerdown');
    link.focus();
    mouseEvent(link, 'pointerup');
    editor.view.dom.focus();
    const enter = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    editor.view.dom.dispatchEvent(enter);
    assert.deepEqual(opened, []);
  });

  it('does not open links when Enter edits ordinary note content', () => {
    const editor = createEditor('Editable note content');
    editor.commands.setTextSelection(9);
    const documentBefore = editor.getJSON();
    editor.view.dom.focus();
    const enter = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    editor.view.dom.dispatchEvent(enter);
    assert.deepEqual(opened, []);
    assert.notDeepEqual(editor.getJSON(), documentBefore);
    assert.equal(updates, 1);
  });
});
