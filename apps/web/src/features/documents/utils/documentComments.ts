import type { Editor } from '@tiptap/react';
import type { DocumentComment } from '@/lib/api/endpoints/documents';

// Scrolls the page to the text a thread quotes. False when there is nothing to scroll
// to yet: no editor, or text the thread no longer has.
export function jumpToComment(editor: Editor | null, comment: DocumentComment): boolean {
  if (!editor || editor.isDestroyed || comment.orphaned) return false;
  // The drawn mark follows local edits the saved positions do not know about yet.
  const mark = editor.view.dom.querySelector(`[data-document-comment="${comment.id}"]`);
  if (mark) {
    mark.scrollIntoView({ block: 'center' });
    return true;
  }
  if (comment.from === null || comment.to === null) return false;
  if (comment.to > editor.state.doc.content.size) return false;
  editor.chain().setTextSelection({ from: comment.from, to: comment.to }).scrollIntoView().run();
  return true;
}
