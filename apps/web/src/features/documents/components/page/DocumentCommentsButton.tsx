'use client';

import { MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDocumentCommentsQuery } from '../../services/documents.service';
import DocumentIconButton from '../DocumentIconButton';

// Toggles the comments panel and counts the threads still open.
export default function DocumentCommentsButton({
  projectKey,
  documentId,
  open,
  onToggle,
}: {
  projectKey: string;
  documentId: number;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('documents');
  const { data: comments = [] } = useDocumentCommentsQuery(projectKey, documentId);
  const openThreads = comments.filter((comment) => !comment.parentId && !comment.resolvedAt).length;

  return (
    <DocumentIconButton
      label={t('comments.title')}
      aria-pressed={open}
      className="w-auto gap-1 px-2"
      onClick={onToggle}
    >
      <MessageSquare />
      {openThreads > 0 && <span className="text-[11px] tabular-nums">{openThreads}</span>}
    </DocumentIconButton>
  );
}
