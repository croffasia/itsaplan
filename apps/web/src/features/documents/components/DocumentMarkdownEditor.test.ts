import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Editor, type JSONContent } from '@tiptap/core';
import { JSDOM } from 'jsdom';
import {
  documentEditorExtensions,
  firstImageFile,
  insertDocumentImage,
  safeDocumentImageSource,
  uploadAndInsertImage,
  syncDocumentEditorEditable,
} from './DocumentMarkdownEditor';

const richDocument: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [
        {
          type: 'text',
          text: 'Rich text',
          marks: [
            { type: 'underline' },
            { type: 'textStyle', attrs: { color: '#dc2626' } },
            { type: 'highlight', attrs: { color: '#fde047' } },
          ],
        },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done' }] }],
        },
      ],
    },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column' }] }],
            },
          ],
        },
      ],
    },
    { type: 'image', attrs: { src: 'https://example.test/image.png', alt: 'Example' } },
  ],
};

const protectedImage =
  '/protected-media/projects/MKT/documents/1/assets/123e4567-e89b-12d3-a456-426614174000/raw';

let dom: JSDOM;
let previousWindow: PropertyDescriptor | undefined;
let previousDocument: PropertyDescriptor | undefined;
let previousNavigator: PropertyDescriptor | undefined;
let previousAnimationFrame: PropertyDescriptor | undefined;

beforeEach(() => {
  previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  previousAnimationFrame = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  dom = new JSDOM('<!doctype html><div id="one"></div><div id="two"></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    requestAnimationFrame: {
      configurable: true,
      value: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    },
  });
});

afterEach(() => {
  dom.window.close();
  for (const [name, descriptor] of [
    ['window', previousWindow],
    ['document', previousDocument],
    ['navigator', previousNavigator],
    ['requestAnimationFrame', previousAnimationFrame],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('DocumentMarkdownEditor JSON persistence', () => {
  it('registers one complete rich-text extension surface', () => {
    const extensions = documentEditorExtensions({
      placeholder: '',
      codeBlockLabel: 'Code',
      tableLabel: 'Table',
      image: { label: 'Image', onPick: () => undefined },
    });
    const editor = new Editor({
      element: document.querySelector('#one') as HTMLElement,
      extensions,
    });
    const names = editor.extensionManager.extensions.map((extension) => extension.name);

    for (const name of [
      'codeBlock',
      'link',
      'image',
      'table',
      'tableRow',
      'tableHeader',
      'tableCell',
      'taskList',
      'taskItem',
      'highlight',
      'textAlign',
      'slashCommand',
      'markdown',
    ]) {
      assert.equal(names.filter((extensionName) => extensionName === name).length, 1, name);
    }
    editor.destroy();
  });

  it('preserves rich-only nodes and marks across an editor remount', () => {
    const extensions = documentEditorExtensions({
      placeholder: '',
      codeBlockLabel: 'Code',
      tableLabel: 'Table',
    });
    const first = new Editor({
      element: document.querySelector('#one') as HTMLElement,
      extensions,
      content: richDocument,
    });
    const persisted = first.getJSON();
    first.destroy();

    const second = new Editor({
      element: document.querySelector('#two') as HTMLElement,
      extensions,
      content: persisted,
    });
    assert.deepEqual(second.getJSON(), persisted);
    second.destroy();
  });

  it('selects image files for paste/drop without consuming unrelated files', () => {
    const text = new window.File(['notes'], 'notes.txt', { type: 'text/plain' });
    const image = new window.File(['image'], 'photo.png', { type: 'image/png' });
    assert.equal(firstImageFile([text]), null);
    assert.equal(firstImageFile([text, image]), image);
  });

  it('updates a mounted editor when the editable prop changes', () => {
    const editor = new Editor({
      element: document.querySelector('#one') as HTMLElement,
      extensions: documentEditorExtensions({
        placeholder: '',
        codeBlockLabel: 'Code',
        tableLabel: 'Table',
      }),
      editable: true,
    });

    syncDocumentEditorEditable(editor, false);
    assert.equal(editor.isEditable, false);

    syncDocumentEditorEditable(editor, true);
    assert.equal(editor.isEditable, true);
    editor.destroy();
  });

  it('keeps links openable in the read-only editor', () => {
    const editor = new Editor({
      element: document.querySelector('#one') as HTMLElement,
      extensions: documentEditorExtensions({
        placeholder: '',
        codeBlockLabel: 'Code',
        tableLabel: 'Table',
      }),
      editable: false,
    });
    const link = editor.extensionManager.extensions.find((extension) => extension.name === 'link');
    assert.ok(link);
    assert.equal(link.options.openOnClick, true);
    editor.destroy();
  });

  it('keeps unsafe link protocols out of the document', () => {
    const editor = new Editor({
      element: document.querySelector('#one') as HTMLElement,
      extensions: documentEditorExtensions({
        placeholder: '',
        codeBlockLabel: 'Code',
        tableLabel: 'Table',
      }),
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Docs' }] }],
      },
    });

    assert.equal(
      editor.chain().selectAll().setLink({ href: 'ftp://example.test/file' }).run(),
      false,
    );
    assert.equal(editor.getAttributes('link').href, undefined);
    assert.equal(editor.chain().selectAll().setLink({ href: '/docs/start' }).run(), true);
    assert.equal(editor.getAttributes('link').href, '/docs/start');
    editor.destroy();
  });

  it('inserts trimmed image sources only while the editor is editable', () => {
    const editor = new Editor({
      element: document.querySelector('#one') as HTMLElement,
      extensions: documentEditorExtensions({
        placeholder: '',
        codeBlockLabel: 'Code',
        tableLabel: 'Table',
      }),
      editable: true,
    });

    assert.equal(insertDocumentImage(editor, true, '   '), false);
    assert.equal(insertDocumentImage(editor, true, ` ${protectedImage} `, 'Photo'), true);
    assert.equal(editor.getAttributes('image').src, protectedImage);

    syncDocumentEditorEditable(editor, false);
    assert.equal(insertDocumentImage(editor, true, '/protected-media/second.png'), false);
    editor.destroy();
  });

  it('accepts only server-compatible image sources', () => {
    assert.equal(safeDocumentImageSource(protectedImage), protectedImage);
    assert.equal(
      safeDocumentImageSource('https://images.example.test/photo.png'),
      'https://images.example.test/photo.png',
    );
    assert.equal(safeDocumentImageSource('javascript:alert(1)'), null);
    assert.equal(safeDocumentImageSource('//images.example.test/photo.png'), null);
    assert.equal(safeDocumentImageSource('https://user:secret@example.test/photo.png'), null);
    assert.equal(safeDocumentImageSource('https://example.test/image with space.png'), null);
  });

  it('does not insert a completed image upload after the editor becomes read-only', async () => {
    const editor = new Editor({
      element: document.querySelector('#one') as HTMLElement,
      extensions: documentEditorExtensions({
        placeholder: '',
        codeBlockLabel: 'Code',
        tableLabel: 'Table',
      }),
      editable: true,
    });
    let resolveUpload!: (asset: { url: string; filename: string }) => void;
    const upload = new Promise<{ url: string; filename: string }>((resolve) => {
      resolveUpload = resolve;
    });
    let currentEditable = true;
    const image = new window.File(['image'], 'photo.png', { type: 'image/png' });
    const insertion = uploadAndInsertImage(
      editor,
      image,
      () => upload,
      0,
      () => currentEditable,
    );

    currentEditable = false;
    syncDocumentEditorEditable(editor, false);
    resolveUpload({ url: protectedImage, filename: 'photo.png' });

    assert.equal(await insertion, false);
    assert.equal(editor.getJSON().content?.some((node) => node.type === 'image') ?? false, false);
    editor.destroy();
  });
});
