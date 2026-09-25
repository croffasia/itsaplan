import type { Editor } from '@tiptap/core';

// A transaction carrying this meta rebuilds the decorations that depend on something
// outside the document: the project keys, the viewer's handle, whether it is editable.
export const REFRESH_DECORATIONS = 'refreshDecorations';

export function refreshDecorations(editor: Editor | null) {
  if (!editor || editor.isDestroyed) return;
  editor.view.dispatch(
    editor.state.tr.setMeta(REFRESH_DECORATIONS, true).setMeta('addToHistory', false),
  );
}
