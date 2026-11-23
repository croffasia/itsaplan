import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { DocumentComment } from '@/lib/api/endpoints/documents';
import { jumpToComment } from '../utils/documentComments';
import type { DocumentSelection } from '../components/DocumentSelectionActions';

export type DocumentCommentsTab = 'open' | 'resolved';

// Which tab of the comments panel shows and which thread is in view. A new selection to
// comment on, or a thread activated from the page or a link, brings its tab forward and
// scrolls the thread into view. `activeId` and `linkedId` may name a reply: its thread
// is meant. The linked thread's text is scrolled into view once, then onLinkShown runs.
export function useDocumentCommentsFocus({
  editor,
  comments,
  selection,
  activeId,
  linkedId,
  onActiveChange,
  onLinkShown,
}: {
  editor: Editor | null;
  comments: DocumentComment[];
  selection: DocumentSelection | null;
  activeId: string | null;
  linkedId: string | null;
  onActiveChange: (id: string | null) => void;
  onLinkShown: () => void;
}) {
  const [tab, setTab] = useState<DocumentCommentsTab>('open');
  const [shownActive, setShownActive] = useState<string | null>(null);
  const [shownSelection, setShownSelection] = useState(selection);
  const threadOf = (id: string | null) => {
    const found = comments.find((comment) => comment.id === id);
    const threadId = found?.parentId ?? found?.id;
    return comments.find((comment) => comment.id === threadId);
  };

  if (selection !== shownSelection) {
    setShownSelection(selection);
    if (selection) setTab('open');
  }
  const active = threadOf(activeId);
  if (active && shownActive !== active.id) {
    setShownActive(active.id);
    setTab(active.resolvedAt ? 'resolved' : 'open');
  }

  useEffect(() => {
    if (active && active.id !== activeId) onActiveChange(active.id);
  }, [active, activeId, onActiveChange]);

  useEffect(() => {
    if (!shownActive) return;
    window.document
      .getElementById(`document-comment-${shownActive}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [shownActive]);

  const linked = threadOf(linkedId);
  useEffect(() => {
    if (!linked) return;
    // The next frame, so the page has drawn the marks this data brought.
    const frame = requestAnimationFrame(() => {
      if (jumpToComment(editor, linked)) onLinkShown();
    });
    return () => cancelAnimationFrame(frame);
  }, [linked, editor, onLinkShown]);

  return {
    tab,
    setTab,
    activeThreadId: active?.id ?? null,
    // Reopening keeps the thread active on the Open tab while the list still has it resolved.
    reopen: (id: string) => {
      setTab('open');
      setShownActive(id);
      onActiveChange(id);
    },
  };
}
