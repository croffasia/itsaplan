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
import { pasteMarkdown } from '@/components/common/editor/pasteMarkdown';

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
let previousNode: PropertyDescriptor | undefined;

beforeEach(() => {
  previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  previousAnimationFrame = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  previousNode = Object.getOwnPropertyDescriptor(globalThis, 'Node');
  dom = new JSDOM('<!doctype html><div id="one"></div><div id="two"></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    Node: { configurable: true, value: dom.window.Node },
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
    ['Node', previousNode],
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
    let updates = 0;
    editor.on('update', () => {
      updates += 1;
    });

    syncDocumentEditorEditable(editor, false);
    assert.equal(editor.isEditable, false);

    syncDocumentEditorEditable(editor, true);
    assert.equal(editor.isEditable, true);
    // An update here would mark the draft dirty and autosave an unedited document.
    assert.equal(updates, 0);
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

describe('DocumentMarkdownEditor markdown paste', () => {
  const editorFor = (content?: JSONContent) =>
    new Editor({
      element: document.querySelector('#one') as HTMLElement,
      extensions: documentEditorExtensions({
        placeholder: '',
        codeBlockLabel: 'Code',
        tableLabel: 'Table',
      }),
      content,
    });

  const clipboard = (text: string, html = '') =>
    ({ getData: (type: string) => (type === 'text/plain' ? text : html) }) as DataTransfer;

  it('parses pasted text as markdown', () => {
    const editor = editorFor();
    assert.equal(pasteMarkdown(editor, clipboard('# Title\n\n- one\n- two')), true);
    assert.equal(editor.storage.markdown.getMarkdown(), '# Title\n\n- one\n- two');
    editor.destroy();
  });

  it('leaves the text to ProseMirror inside a code block', () => {
    const editor = editorFor({ type: 'doc', content: [{ type: 'codeBlock' }] });
    editor.commands.focus();
    assert.equal(pasteMarkdown(editor, clipboard('# Title')), false);
    editor.destroy();
  });

  // A copy from this editor carries the whole document shape in its HTML; the
  // plain text beside it has lost the "#" and the "-" that make it markdown.
  it('leaves a copy from a ProseMirror editor to ProseMirror', () => {
    const editor = editorFor();
    const html = '<div data-pm-slice="1 1 []"><h1>Title</h1><ul><li><p>one</p></li></ul></div>';
    assert.equal(pasteMarkdown(editor, clipboard('Title\n\none', html)), false);
    editor.destroy();
  });
});

describe('DocumentMarkdownEditor schema attrs', () => {
  // The API validates the saved JSON against a per-node allowlist and rejects the
  // whole save on any attr it does not know, null included. This pins the schema
  // that produces that JSON: an attr added by a tiptap upgrade fails here first,
  // and the allowlist in apps/api documents service.ts is what has to grow.
  it('keeps every node and mark to the attrs the API accepts', () => {
    const editor = new Editor({
      element: document.querySelector('#one') as HTMLElement,
      extensions: documentEditorExtensions({
        placeholder: '',
        codeBlockLabel: 'Code',
        tableLabel: 'Table',
      }),
    });

    const attrsOf = (types: Record<string, { spec: { attrs?: object } }>) =>
      Object.fromEntries(
        Object.entries(types).map(([name, type]) => [
          name,
          Object.keys(type.spec.attrs ?? {}).sort(),
        ]),
      );
    assert.deepEqual(attrsOf(editor.schema.nodes), {
      doc: [],
      paragraph: ['textAlign'],
      text: [],
      blockquote: [],
      bulletList: ['tight'],
      orderedList: ['start', 'tight', 'type'],
      listItem: [],
      heading: ['level', 'textAlign'],
      horizontalRule: [],
      hardBreak: [],
      codeBlock: ['language'],
      image: ['alt', 'src', 'style', 'title', 'width'],
      table: [],
      tableRow: [],
      tableHeader: ['align', 'colspan', 'colwidth', 'rowspan'],
      tableCell: ['align', 'colspan', 'colwidth', 'rowspan'],
      taskList: [],
      taskItem: ['checked'],
    });
    assert.deepEqual(attrsOf(editor.schema.marks), {
      bold: [],
      italic: [],
      strike: [],
      code: [],
      link: ['class', 'href', 'rel', 'target', 'title'],
      textStyle: ['color'],
      underline: [],
      highlight: ['color'],
    });
    editor.destroy();
  });
});
