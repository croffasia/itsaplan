import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import { MessageSquare, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  addDocumentComment,
  listDocumentComments,
  updateDocumentComment,
} from '@/lib/api/endpoints/documents';
import { qk } from '@/services/queryKeys';
import { useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import DocumentCommentThread from './DocumentCommentThread';
import type { DocumentSelection } from './DocumentSelectionActions';

export default function DocumentCommentsPanel({
  editor,
  projectKey,
  documentId,
  version,
  selection,
  canComment,
  onClose,
  onCommented,
}: {
  editor: Editor | null;
  projectKey: string;
  documentId: number;
  version: number;
  selection: DocumentSelection | null;
  canComment: boolean;
  onClose: () => void;
  onCommented: () => void;
}) {
  const t = useTranslations('documents.comments');
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const key = qk.documentComments(projectKey, documentId);
  const query = useQuery({
    queryKey: key,
    queryFn: () => listDocumentComments(projectKey, documentId),
  });
  const create = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: (input: {
      body: string;
      parentId?: string;
      quote?: string;
      from?: number;
      to?: number;
    }) =>
      addDocumentComment(projectKey, documentId, {
        ...input,
        version: input.parentId ? version : (selection?.version ?? version),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const update = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: ({ id, input }: { id: string; input: { body?: string; resolved?: boolean } }) =>
      updateDocumentComment(projectKey, documentId, id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const comments = query.data ?? [];
  const roots = comments.filter(
    (item) => !item.parentId && Boolean(item.resolvedAt) === showResolved,
  );
  const busy = create.isPending || update.isPending;
  return (
    <aside
      aria-label={t('title')}
      className="absolute inset-y-0 end-0 z-30 flex w-[min(100%,360px)] flex-col border-s bg-background shadow-sm motion-safe:animate-in motion-safe:fade-in md:relative md:w-[340px] md:shrink-0 md:shadow-none"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <MessageSquare className="size-4" />
        <h2 className="flex-1 text-sm font-medium">{t('title')}</h2>
        <Button size="icon-sm" variant="ghost" aria-label={t('close')} onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {selection && canComment && (
          <form
            className="space-y-3 border-b p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void create
                .mutateAsync({ ...selection, quote: selection.quote.slice(0, 2000), body })
                .then(() => {
                  setBody('');
                  onCommented();
                })
                .catch(() => undefined);
            }}
          >
            <blockquote className="line-clamp-3 border-s-2 border-primary/40 ps-3 text-xs leading-5 text-muted-foreground">
              {selection.quote}
            </blockquote>
            <Textarea
              autoFocus
              aria-label={t('add')}
              placeholder={t('placeholder')}
              value={body}
              maxLength={10000}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter')
                  event.currentTarget.form?.requestSubmit();
              }}
            />
            <Button size="sm" disabled={busy || !body.trim()}>
              {t('send')}
            </Button>
          </form>
        )}
        <div className="flex gap-1 border-b px-3 py-2">
          {[false, true].map((resolved) => (
            <Button
              key={String(resolved)}
              size="sm"
              variant={showResolved === resolved ? 'secondary' : 'ghost'}
              onClick={() => setShowResolved(resolved)}
            >
              {resolved ? t('resolved') : t('open')}
            </Button>
          ))}
        </div>
        {(create.isError || update.isError) && (
          <p role="alert" className="p-4 text-xs text-destructive">
            {t('failed')}
          </p>
        )}
        {query.isLoading ? (
          <p className="p-4 text-xs text-muted-foreground">{t('loading')}</p>
        ) : query.isError ? (
          <Button variant="ghost" onClick={() => void query.refetch()}>
            {t('retry')}
          </Button>
        ) : !roots.length ? (
          <p className="px-6 py-12 text-center text-sm leading-6 text-muted-foreground">
            {showResolved ? t('noResolved') : t('empty')}
          </p>
        ) : (
          roots.map((comment) => (
            <DocumentCommentThread
              key={comment.id}
              comment={comment}
              replies={comments.filter((item) => item.parentId === comment.id)}
              userId={session?.user.id ?? null}
              canComment={canComment}
              busy={busy}
              onReply={async (body) => {
                await create.mutateAsync({ body, parentId: comment.id });
              }}
              onUpdate={async (id, input) => {
                await update.mutateAsync({ id, input });
              }}
              onJump={() => {
                if (
                  editor &&
                  comment.from !== null &&
                  comment.to !== null &&
                  comment.to <= editor.state.doc.content.size
                )
                  editor
                    .chain()
                    .setTextSelection({ from: comment.from, to: comment.to })
                    .scrollIntoView()
                    .run();
              }}
            />
          ))
        )}
      </div>
    </aside>
  );
}
