import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Editor } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { JSDOM } from 'jsdom';
import { issueEditorStarterKitOptions } from './IssueMarkdownEditor';

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
});
