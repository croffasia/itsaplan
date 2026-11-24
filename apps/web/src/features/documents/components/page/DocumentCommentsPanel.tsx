'use client';

import type { Editor } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useDocumentComments } from '../../hooks/useDocumentComments';
import {
  type DocumentCommentsTab,
  useDocumentCommentsFocus,
} from '../../hooks/useDocumentCommentsFocus';
import DocumentCommentDraft from './DocumentCommentDraft';
import DocumentCommentsState from './DocumentCommentsState';
import DocumentCommentsTabs from './DocumentCommentsTabs';
import DocumentCommentsThreads from './DocumentCommentsThreads';
import type { DocumentSelection } from '../DocumentSelectionActions';
import DocumentSidePanel from './DocumentSidePanel';

// The discussions on the page's text, open and resolved. `linkedId` is the comment a
// `?comment=` link points at, a thread or one of its replies: the panel shows its thread
// and scrolls the page to its text, then calls onLinkShown.
export default function DocumentCommentsPanel({
  editor,
  projectKey,
  documentId,
  version,
  selection,
  canComment,
  activeId,
  linkedId,
  onActiveChange,
  onLinkShown,
  onClose,
  onDraftClose,
}: {
  editor: Editor | null;
  projectKey: string;
  documentId: number;
  version: number;
  selection: DocumentSelection | null;
  canComment: boolean;
  activeId: string | null;
  linkedId: string | null;
  onActiveChange: (id: string | null) => void;
  onLinkShown: () => void;
  onClose: () => void;
  onDraftClose: () => void;
}) {
  const t = useTranslations('documents.comments');
  const { query, start, reply, update } = useDocumentComments(projectKey, documentId, version);
  const comments = query.data ?? [];
  const { tab, setTab, activeThreadId, reopen } = useDocumentCommentsFocus({
    editor,
    comments,
    selection,
    activeId,
    linkedId,
    onActiveChange,
    onLinkShown,
  });
  const roots = comments.filter((comment) => !comment.parentId).reverse();
  const open = roots.filter((comment) => !comment.resolvedAt);
  const resolved = roots.filter((comment) => comment.resolvedAt);
  const list = tab === 'open' ? open : resolved;
  const drafting = selection !== null && canComment && tab === 'open';
  let emptyMessage: string;
  if (tab === 'resolved') emptyMessage = t('noResolved');
  else if (canComment) emptyMessage = t('empty');
  else emptyMessage = t('noOpen');

  const send = (body: string) => {
    if (!selection) return;
    void start
      .mutateAsync({ ...selection, body })
      .then(({ id }) => {
        onActiveChange(id);
        onDraftClose();
      })
      .catch(() => undefined);
  };

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as DocumentCommentsTab)}
      className="contents"
    >
      <DocumentSidePanel
        label={t('title')}
        closeLabel={t('close')}
        onClose={onClose}
        actions={<DocumentCommentsTabs open={open.length} resolved={resolved.length} />}
      >
        <TabsContent
          value={tab}
          className="flex min-h-0 flex-1 [scrollbar-width:thin] flex-col gap-2 overflow-y-auto px-2 pt-1 pb-8"
        >
          {drafting && (
            <DocumentCommentDraft
              key={`${selection.from}:${selection.to}`}
              projectKey={projectKey}
              documentId={documentId}
              quote={selection.quote}
              failed={
                start.isError &&
                start.variables?.from === selection.from &&
                start.variables?.to === selection.to
              }
              busy={start.isPending}
              onSubmit={send}
              onCancel={() => {
                start.reset();
                onDraftClose();
              }}
            />
          )}
          {query.isLoading ? (
            <DocumentCommentsState kind="loading" />
          ) : query.isError ? (
            <DocumentCommentsState kind="failed" onRetry={() => void query.refetch()} />
          ) : list.length ? (
            <DocumentCommentsThreads
              editor={editor}
              projectKey={projectKey}
              comments={comments}
              threads={list}
              activeId={activeId}
              activeThreadId={activeThreadId}
              canComment={canComment}
              reply={reply}
              update={update}
              onActiveChange={onActiveChange}
              onReopen={reopen}
            />
          ) : drafting ? null : (
            <DocumentCommentsState kind="empty" message={emptyMessage} />
          )}
        </TabsContent>
      </DocumentSidePanel>
    </Tabs>
  );
}
