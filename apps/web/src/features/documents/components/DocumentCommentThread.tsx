import { useState } from 'react';
import { Check, CornerDownRight, Pencil, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DocumentComment } from '@/lib/api/endpoints/documents';
import MarkdownEditor from '@/components/common/editor/MarkdownEditor';
import { Button } from '@/components/ui/button';
import DocumentCommentInput from './DocumentCommentInput';

export default function DocumentCommentThread({
  projectKey,
  documentId,
  comment,
  replies,
  userId,
  canComment,
  busy,
  onReply,
  onUpdate,
  onJump,
}: {
  projectKey: string;
  documentId: number;
  comment: DocumentComment;
  replies: DocumentComment[];
  userId: string | null;
  canComment: boolean;
  busy: boolean;
  onReply: (body: string) => Promise<void>;
  onUpdate: (id: string, input: { body?: string; resolved?: boolean }) => Promise<void>;
  onJump: () => void;
}) {
  const t = useTranslations('documents.comments');
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [edit, setEdit] = useState<{ id: string; body: string } | null>(null);
  const items = [comment, ...replies];
  return (
    <article id={`document-comment-${comment.id}`} className="border-b px-4 py-4">
      <button
        type="button"
        onClick={onJump}
        disabled={comment.orphaned}
        className="mb-3 block w-full border-s-2 border-primary/40 ps-3 text-start text-xs leading-5 text-muted-foreground hover:text-foreground"
      >
        <span className="line-clamp-3">{comment.quote}</span>
        {comment.orphaned && <span className="mt-1 block italic">{t('textRemoved')}</span>}
      </button>
      {items.map((item) => (
        <div key={item.id} className={item.parentId ? 'ms-3 mt-3 border-s ps-3' : ''}>
          <div className="mb-1 flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate font-medium">
              {item.authorName ?? t('unknownAuthor')}
            </span>
            {canComment && item.authorId === userId && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('edit')}
                onClick={() => setEdit({ id: item.id, body: item.body })}
              >
                <Pencil className="size-3" />
              </Button>
            )}
          </div>
          {edit?.id === item.id ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void onUpdate(item.id, { body: edit.body })
                  .then(() => setEdit(null))
                  .catch(() => undefined);
              }}
              className="space-y-2"
            >
              <DocumentCommentInput
                projectKey={projectKey}
                documentId={documentId}
                value={edit.body}
                onValueChange={(body) => setEdit({ id: item.id, body })}
                aria-label={t('edit')}
              />
              <Button size="sm" disabled={busy || !edit.body.trim()}>
                {t('save')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEdit(null)}>
                {t('cancel')}
              </Button>
            </form>
          ) : (
            <MarkdownEditor
              key={item.body}
              className="text-sm leading-6 break-words"
              defaultValue={item.body}
              editable={false}
            />
          )}
        </div>
      ))}
      {canComment && (
        <div className="mt-3 flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setReplying((value) => !value)}>
            <CornerDownRight className="size-3.5" />
            {t('reply')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void onUpdate(comment.id, { resolved: !comment.resolvedAt }).catch(() => undefined)
            }
          >
            {comment.resolvedAt ? (
              <RotateCcw className="size-3.5" />
            ) : (
              <Check className="size-3.5" />
            )}
            {comment.resolvedAt ? t('reopen') : t('resolve')}
          </Button>
        </div>
      )}
      {replying && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void onReply(reply)
              .then(() => {
                setReply('');
                setReplying(false);
              })
              .catch(() => undefined);
          }}
        >
          <DocumentCommentInput
            projectKey={projectKey}
            documentId={documentId}
            value={reply}
            onValueChange={setReply}
            aria-label={t('reply')}
            placeholder={t('replyPlaceholder')}
          />
          <Button size="sm" disabled={busy || !reply.trim()}>
            {t('send')}
          </Button>
        </form>
      )}
    </article>
  );
}
