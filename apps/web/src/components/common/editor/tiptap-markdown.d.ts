import type { MarkdownStorage } from 'tiptap-markdown';

// tiptap-markdown ships its storage type but never augments tiptap's Storage
// interface, so `editor.storage.markdown` is untyped on a plain Editor (it is
// only inferred where the extensions array is in scope). Declared here so any
// holder of the editor instance can read the markdown back.
declare module '@tiptap/core' {
  interface Storage {
    markdown: MarkdownStorage;
  }
}
