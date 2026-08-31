import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Editor } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { JSDOM } from 'jsdom';
import { issueEditorStarterKitOptions } from './IssueMarkdownEditor';
import { openLinkOnModifierClick } from '../../utils/modifierClickLink';

let dom: JSDOM;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;

beforeEach(() => {
  originalGlobalDescriptors = new Map(
    ['window', 'document', 'navigator'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  dom = new JSDOM('<!doctype html><div></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
  });
});

afterEach(() => {
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('IssueMarkdownEditor extensions', () => {
  it('registers the configured link extension once', () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure(issueEditorStarterKitOptions),
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
