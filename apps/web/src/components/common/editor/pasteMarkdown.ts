import type { Editor } from '@tiptap/core';

// Text is pasted as markdown source, so "# Title" becomes a heading. An editor or
// a web page also puts HTML on the clipboard, which ProseMirror would prefer and
// which carries none of the "#" and ">" structure. Inside a code block the text
// stays literal.
//
// A copy from a ProseMirror editor is the exception: it is marked with
// data-pm-slice and its HTML is the richer source, since markdown carries neither
// a table's alignment and widths nor a text colour.
export function pasteMarkdown(editor: Editor, clipboard: DataTransfer | null): boolean {
  const text = clipboard?.getData('text/plain');
  const { selection } = editor.state;
  if (!text || selection.$from.parent.type.spec.code) return false;
  if (clipboard?.getData('text/html').includes('data-pm-slice')) return false;
  // insertContentAt is the command tiptap-markdown overrides to read markdown.
  const { from, to } = selection;
  return editor.chain().focus().insertContentAt({ from, to }, text).run();
}
