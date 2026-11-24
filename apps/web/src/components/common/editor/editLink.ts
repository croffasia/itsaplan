import type { Editor } from '@tiptap/react';

// A transaction carrying this meta asks EditorSelectionMenu to open its link field.
export const EDIT_LINK = 'editLink';

// Selects the whole link `anchor` belongs to and opens the link field over it.
export function editLink(editor: Editor, anchor: HTMLElement) {
  if (editor.isDestroyed || !editor.isEditable) return;
  const position = editor.view.posAtDOM(anchor, 0);
  editor
    .chain()
    .focus()
    .setTextSelection(position)
    .extendMarkRange('link')
    .setMeta(EDIT_LINK, true)
    .run();
}
