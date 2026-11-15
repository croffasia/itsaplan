import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// The part of tiptap-markdown's serializer state the extensions here use. `out` is the
// markdown written so far; `inTable` is what makes a hard break serialize as <br>.
export type MarkdownState = {
  out: string;
  inTable: boolean;
  write: (text: string) => void;
  renderInline: (node: ProseMirrorNode) => void;
  ensureNewLine: () => void;
  closeBlock: (node: ProseMirrorNode) => void;
};
