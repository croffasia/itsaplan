import { createDocument, Editor, type JSONContent } from '@tiptap/core';
import { documentEditorExtensions } from '../components/DocumentMarkdownEditor';

// Mirror the api's limits on a page: the content maxLength of the document bodies,
// and the node and byte caps it checks contentJson against.
const MAX_MARKDOWN_CHARACTERS = 250_000;
const MAX_JSON_NODES = 10_000;
const MAX_JSON_BYTES = 1_000_000;

export const markdownTitle = (filename: string) =>
  filename
    .trim()
    .replace(/\.(md|markdown)$/i, '')
    .trim();

export const markdownJson = (editor: Editor, markdown: string): JSONContent =>
  createDocument(
    editor.storage.markdown.parser.parse(markdown),
    editor.schema,
    editor.options.parseOptions,
  ).toJSON();

const nodeCount = (node: JSONContent): number =>
  1 + (node.content ?? []).reduce((sum, child) => sum + nodeCount(child), 0);

// Null when the file is larger than a page the api accepts.
export function importedMarkdownJson(markdown: string): JSONContent | null {
  if (markdown.length > MAX_MARKDOWN_CHARACTERS) return null;
  const editor = new Editor({
    extensions: documentEditorExtensions({ placeholder: '', codeBlockLabel: '', tableLabel: '' }),
  });
  try {
    const json = markdownJson(editor, markdown);
    return nodeCount(json) <= MAX_JSON_NODES &&
      new TextEncoder().encode(JSON.stringify(json)).length <= MAX_JSON_BYTES
      ? json
      : null;
  } finally {
    editor.destroy();
  }
}
