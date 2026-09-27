import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Editor } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { JSDOM } from 'jsdom';
import { editorStarterKitOptions } from './MarkdownEditor';
import { openLinkOnModifierClick } from './modifierClickLink';
import { createLinkKeyboardHandlers } from './linkKeyboardHandlers';

let dom: JSDOM;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

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
    ].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div></div>', { url: 'https://planner.test' });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    DOMParser: { configurable: true, value: dom.window.DOMParser },
    Node: { configurable: true, value: dom.window.Node },
    Element: { configurable: true, value: dom.window.Element },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    HTMLAnchorElement: { configurable: true, value: dom.window.HTMLAnchorElement },
  });
});

afterEach(() => {
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('MarkdownEditor extensions', () => {
  it('does not edit the document when Enter activates a focused link', () => {
    const opened: unknown[] = [];
    dom.window.open = (...args: Parameters<typeof window.open>) => {
      opened.push(args);
      return null;
    };
    const editor = new Editor({
      element: dom.window.document.querySelector('div')!,
      extensions: [
        StarterKit.configure(editorStarterKitOptions),
        Link.configure({ openOnClick: false, HTMLAttributes: { tabindex: '0' } }),
      ],
      content: '<p><a href="https://example.com/docs">Docs</a> content</p>',
      editorProps: {
        handleDOMEvents: createLinkKeyboardHandlers(),
        handleScrollToSelection: () => true,
      },
    });
    const before = editor.getHTML();
    const link = editor.view.dom.querySelector('a')!;
    link.focus();
    editor.view.dom.focus();
    editor.view.dom.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    assert.equal(editor.getHTML(), before);
    assert.deepEqual(opened, [['https://example.com/docs', '_blank', 'noopener,noreferrer']]);
    link.focus();
    link.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true }));
    editor.view.dom.focus();
    editor.view.dom.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    assert.notEqual(editor.getHTML(), before);
    assert.equal(opened.length, 1);
    editor.destroy();
  });
  it('registers the configured link extension once', () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure(editorStarterKitOptions),
        Link.configure({ openOnClick: false, autolink: true }),
      ],
      content: '',
    });

    assert.equal(
      editor.extensionManager.extensions.filter((extension) => extension.name === 'link').length,
      1,
    );
    editor.destroy();
  });

  it('opens links only with the platform modifier', () => {
    const root = dom.window.document.querySelector('div')!;
    root.innerHTML = '<a href="https://example.com/docs">Docs</a>';
    const link = root.querySelector('a')!;
    const opened: Array<unknown> = [];
    dom.window.open = (...args: Parameters<typeof window.open>) => {
      opened.push(args);
      return null;
    };

    const plain = new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    link.dispatchEvent(plain);
    assert.equal(openLinkOnModifierClick(plain, root), false);

    for (const modifier of [{ metaKey: true }, { ctrlKey: true }]) {
      const event = new dom.window.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...modifier,
      });
      link.dispatchEvent(event);
      assert.equal(openLinkOnModifierClick(event, root), true);
      assert.equal(event.defaultPrevented, true);
    }

    assert.deepEqual(opened, [
      ['https://example.com/docs', '_blank', 'noopener,noreferrer'],
      ['https://example.com/docs', '_blank', 'noopener,noreferrer'],
    ]);
  });

  it('does not open unsafe link protocols', () => {
    const root = dom.window.document.querySelector('div')!;
    root.innerHTML = '<a href="javascript:alert(1)">Unsafe</a>';
    const link = root.querySelector('a')!;
    const event = new dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });
    link.dispatchEvent(event);

    assert.equal(openLinkOnModifierClick(event, root), false);
    assert.equal(event.defaultPrevented, false);
  });
});

describe('MarkdownEditor touch links', () => {
  function setup({ editable = true, openOnTouch = true } = {}) {
    const opened: unknown[] = [];
    dom.window.open = (...args: Parameters<typeof window.open>) => {
      opened.push(args);
      return null;
    };
    const editor = new Editor({
      element: dom.window.document.querySelector('div')!,
      editable,
      extensions: [
        StarterKit.configure(editorStarterKitOptions),
        Link.configure({ openOnClick: false, HTMLAttributes: { tabindex: '0' } }),
      ],
      content: '<p><a href="https://example.com/docs"><strong>Docs</strong></a> text</p>',
      editorProps: {
        handleClick: (view, _pos, event) => openLinkOnModifierClick(event, view.dom),
        handleDOMEvents: createLinkKeyboardHandlers(openOnTouch),
        handleScrollToSelection: () => true,
      },
    });
    const link = editor.view.dom.querySelector('a')!;
    let time = 0;
    function dispatch(target: Element, event: MouseEvent) {
      Object.defineProperty(event, 'timeStamp', { value: (time += 20) });
      target.dispatchEvent(event);
      return event;
    }
    function pointer(target: Element, type: string, options: PointerEventInit = {}) {
      return dispatch(
        target,
        new dom.window.PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerType: 'touch',
          pointerId: 1,
          isPrimary: true,
          clientX: 10,
          clientY: 10,
          ...options,
        }),
      );
    }
    function click(target = link, options: MouseEventInit = {}) {
      return dispatch(
        target,
        new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, ...options }),
      );
    }
    return { editor, opened, link, pointer, click, advance: (ms: number) => (time += ms) };
  }

  it('opens a completed touch click once without consuming pointer events or changing content', () => {
    const { editor, opened, link, pointer } = setup();
    const target = link.querySelector('strong')!;
    const before = editor.getHTML();
    assert.equal(pointer(target, 'pointerdown').defaultPrevented, false);
    assert.equal(pointer(target, 'pointerup').defaultPrevented, false);
    assert.equal(opened.length, 0);
    assert.equal(pointer(target, 'click').defaultPrevented, true);
    pointer(target, 'click');
    assert.equal(editor.getHTML(), before);
    assert.deepEqual(opened, [['https://example.com/docs', '_blank', 'noopener,noreferrer']]);
    editor.destroy();
  });

  it('uses the preceding touch sequence when the browser emits a MouseEvent click', () => {
    const { editor, opened, link, pointer, click } = setup();
    for (const href of ['/project/EX', 'mailto:test@example.com', 'tel:+4912345']) {
      link.href = href;
      pointer(link, 'pointerdown');
      pointer(link, 'pointerup');
      assert.equal(click().defaultPrevented, true);
    }
    assert.deepEqual(opened, [
      ['https://planner.test/project/EX', '_blank', 'noopener,noreferrer'],
      ['mailto:test@example.com', '_blank', 'noopener,noreferrer'],
      ['tel:+4912345', '_blank', 'noopener,noreferrer'],
    ]);
    editor.destroy();
  });

  for (const gesture of ['move', 'release-away', 'cancel', 'hold', 'context-menu', 'multi-touch']) {
    it(`does not open after ${gesture}`, () => {
      const { editor, opened, link, pointer, click, advance } = setup();
      pointer(link, 'pointerdown');
      if (gesture === 'move') pointer(link, 'pointermove', { clientY: 30 });
      if (gesture === 'cancel') pointer(link, 'pointercancel');
      if (gesture === 'hold') advance(600);
      if (gesture === 'context-menu') pointer(link, 'contextmenu');
      if (gesture === 'multi-touch')
        pointer(link, 'pointerdown', { pointerId: 2, isPrimary: false });
      pointer(link, 'pointerup', gesture === 'release-away' ? { clientY: 30 } : {});
      assert.equal(click().defaultPrevented, false);
      assert.deepEqual(opened, []);
      editor.destroy();
    });
  }

  it('leaves text selection and an incomplete touch sequence alone', () => {
    const { editor, opened, link, pointer, click } = setup();
    pointer(link, 'pointerdown');
    assert.equal(click().defaultPrevented, false);
    pointer(link, 'pointerdown');
    pointer(link, 'pointerup');
    const range = dom.window.document.createRange();
    range.selectNodeContents(link);
    dom.window.getSelection()!.addRange(range);
    assert.equal(click().defaultPrevented, false);
    assert.deepEqual(opened, []);
    editor.destroy();
  });

  it('does not open a different link or consume touch state for a mouse click', () => {
    const { editor, opened, link, pointer, click } = setup();
    const second = dom.window.document.createElement('a');
    second.href = 'https://example.com/other';
    editor.view.dom.append(second);
    pointer(link, 'pointerdown');
    pointer(link, 'pointerup');
    assert.equal(click(second).defaultPrevented, false);
    pointer(link, 'pointerdown');
    pointer(link, 'pointerup');
    assert.equal(pointer(link, 'click', { pointerType: 'mouse' }).defaultPrevented, false);
    pointer(link, 'pointerdown', { pointerType: 'mouse' });
    pointer(link, 'pointerup', { pointerType: 'mouse' });
    assert.equal(click().defaultPrevented, false);
    assert.deepEqual(opened, []);
    editor.destroy();
  });

  it('does not duplicate modifier opening or bypass the protocol guard', () => {
    const { editor, opened, link, pointer, click } = setup();
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      pointer(link, 'pointerdown');
      pointer(link, 'pointerup');
      assert.equal(click(link, modifier).defaultPrevented, false);
    }
    for (const href of ['javascript:alert(1)', 'data:text/html,unsafe']) {
      link.href = href;
      pointer(link, 'pointerdown');
      pointer(link, 'pointerup');
      assert.equal(click().defaultPrevented, false);
    }
    assert.deepEqual(opened, []);
    editor.destroy();
  });

  it('leaves read-only links and editors without touch handling to their existing behavior', () => {
    for (const options of [{ editable: false }, { openOnTouch: false }]) {
      const { editor, opened, link, pointer, click } = setup(options);
      pointer(link, 'pointerdown');
      pointer(link, 'pointerup');
      assert.equal(click().defaultPrevented, false);
      assert.deepEqual(opened, []);
      editor.destroy();
    }
  });
});

describe('MarkdownEditor markdown round trip', () => {
  // The editor reports a blur only when the document changed, because reading the
  // markdown back does not return the stored text. This pins the reason: drop it and
  // the guard becomes dead weight, keep it and removing the guard saves on every
  // focus.
  it('serialises a bare url back as an autolink', () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure(editorStarterKitOptions),
        Link.configure({ openOnClick: false, autolink: true }),
        Markdown.configure({ html: true, linkify: true, breaks: true }),
      ],
      content: 'See https://example.com/spec for details.',
    });

    const roundTripped = editor.storage.markdown.getMarkdown();
    assert.equal(roundTripped, 'See <https://example.com/spec> for details.');
    assert.notEqual(roundTripped, 'See https://example.com/spec for details.');
    editor.destroy();
  });
});
