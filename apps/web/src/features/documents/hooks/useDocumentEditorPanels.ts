import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { DocumentSelection } from '../components/DocumentSelectionActions';

// The side panel beside an open page: the comments or the details, one at a time.
export function useDocumentEditorPanels(commentId: string | null) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentSelection, setCommentSelection] = useState<DocumentSelection | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [detailsFocus, setDetailsFocus] = useState<{ section: 'work' } | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  // A `?comment=` link, or the inbox beside a comment notification, opens the comments on its
  // thread.
  const searchCommentId = useSearchParams().get('comment');
  const linkedCommentId = commentId ?? searchCommentId;
  const [shownLink, setShownLink] = useState<string | null>(null);
  const [linkPending, setLinkPending] = useState(false);
  if (linkedCommentId && linkedCommentId !== shownLink) {
    setShownLink(linkedCommentId);
    setLinkPending(true);
    setCommentsOpen(true);
    setInspectorOpen(false);
    setActiveCommentId(linkedCommentId);
  }
  const showComments = () => {
    setCommentsOpen(true);
    setInspectorOpen(false);
  };

  return {
    commentsOpen,
    inspectorOpen,
    detailsFocus,
    commentSelection,
    activeCommentId,
    linkedCommentId: linkPending ? linkedCommentId : null,
    setActiveCommentId,
    onLinkShown: () => setLinkPending(false),
    showThread: (id: string) => {
      showComments();
      setActiveCommentId(id);
    },
    commentOn: (selection: DocumentSelection) => {
      setCommentSelection(selection);
      showComments();
    },
    clearSelection: () => setCommentSelection(null),
    toggleComments: () => {
      setCommentsOpen((value) => !value);
      setInspectorOpen(false);
    },
    closeComments: () => {
      setCommentsOpen(false);
      setActiveCommentId(null);
    },
    toggleInspector: () => {
      setInspectorOpen(!inspectorOpen);
      if (!inspectorOpen) setCommentsOpen(false);
    },
    openDetails: (section?: 'work') => {
      setInspectorOpen(true);
      setCommentsOpen(false);
      setDetailsFocus(section ? { section } : null);
    },
    closeInspector: () => setInspectorOpen(false),
  };
}
