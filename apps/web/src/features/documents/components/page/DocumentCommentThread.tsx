'use client';

import { Check, CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DocumentComment } from '@/lib/api/endpoints/documents';
import { Button } from '@/components/ui/button';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { cn } from '@/lib/utils';
import DocumentCommentMessage from './DocumentCommentMessage';
import DocumentCommentReply from './DocumentCommentReply';

// One discussion: the quoted text, its messages, and a reply box or who resolved it.
export default function DocumentCommentThread({
  projectKey,
  comment,
  replies,
  images,
  userId,
  active,
  canComment,
  busy,
  onActivate,
  onHover,
  onResolve,
  onReopen,
  onReply,
  onEdit,
}: {
  projectKey: string;
  comment: DocumentComment;
  replies: DocumentComment[];
  images: Map<string, string | null>;
  userId: string | null;
  active: boolean;
  canComment: boolean;
  busy: boolean;
  onActivate: () => void;
  onHover: (hovered: boolean) => void;
  onResolve: () => void;
  onReopen: () => void;
  onReply: (body: string) => Promise<void>;
  onEdit: (id: string, body: string) => Promise<void>;
}) {
  const t = useTranslations('documents.comments');
  const relativeTime = useRelativeTime();
  const resolved = comment.resolvedAt !== null;

  return (
    <article
      id={`document-comment-${comment.id}`}
      className={cn(
        'scroll-mt-2 rounded-xl p-3 transition-colors',
        active ? 'bg-card shadow-[var(--tile-shadow)]' : 'hover:bg-muted/45',
      )}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="mb-3 flex items-start gap-1.5">
        <button
          type="button"
          dir="auto"
          title={comment.orphaned ? t('textRemoved') : t('showInPage')}
          className={cn(
            'line-clamp-2 min-w-0 flex-1 rounded-md px-2.5 py-1 text-start text-[13px] leading-[1.45] text-muted-foreground transition-colors hover:text-foreground',
            comment.orphaned
              ? 'bg-muted line-through decoration-input'
              : 'bg-[color-mix(in_oklab,var(--warning)_15%,transparent)]',
          )}
          onClick={onActivate}
        >
          {comment.quote}
        </button>
        {!resolved && canComment && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={t('resolve')}
            title={t('resolve')}
            disabled={busy}
            onClick={onResolve}
          >
            <Check />
          </Button>
        )}
      </div>
      {comment.orphaned && (
        <p className="-mt-1.5 mb-3 text-xs text-muted-foreground italic">{t('textRemoved')}</p>
      )}
      {[comment, ...replies].map((item) => (
        <DocumentCommentMessage
          key={item.id}
          projectKey={projectKey}
          comment={item}
          image={item.authorId ? (images.get(item.authorId) ?? null) : null}
          canEdit={canComment && item.authorId !== null && item.authorId === userId}
          busy={busy}
          onSave={(body) => onEdit(item.id, body)}
        />
      ))}
      {resolved ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleCheck className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">
            {comment.resolvedByName
              ? t('resolvedBy', {
                  name: comment.resolvedByName,
                  time: relativeTime(comment.resolvedAt!),
                })
              : t('resolvedAt', { time: relativeTime(comment.resolvedAt!) })}
          </span>
          {canComment && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ms-auto h-7 text-muted-foreground"
              disabled={busy}
              onClick={onReopen}
            >
              {t('reopen')}
            </Button>
          )}
        </div>
      ) : (
        canComment && (
          <DocumentCommentReply
            projectKey={projectKey}
            documentId={comment.documentId}
            busy={busy}
            onReply={onReply}
          />
        )
      )}
    </article>
  );
}
