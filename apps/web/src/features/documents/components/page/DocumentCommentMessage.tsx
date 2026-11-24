'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DocumentComment } from '@/lib/api/endpoints/documents';
import Avatar from '@/components/common/Avatar';
import MarkdownEditor from '@/components/common/editor/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { useRelativeTime } from '@/context/relativeTimeContext';
import DocumentCommentInput from './DocumentCommentInput';

// One message of a thread. Its author edits it in place.
export default function DocumentCommentMessage({
  projectKey,
  comment,
  image,
  canEdit,
  busy,
  onSave,
}: {
  projectKey: string;
  comment: DocumentComment;
  image: string | null;
  canEdit: boolean;
  busy: boolean;
  onSave: (body: string) => Promise<void>;
}) {
  const t = useTranslations('documents.comments');
  const relativeTime = useRelativeTime();
  const [draft, setDraft] = useState<string | null>(null);
  const name = comment.authorName ?? t('unknownAuthor');

  return (
    <div className="group/msg relative flex gap-2.5 not-last:pb-3.5 not-last:before:absolute not-last:before:start-[11.5px] not-last:before:top-[30px] not-last:before:bottom-1 not-last:before:w-px not-last:before:bg-border">
      <Avatar name={name} image={image} className="size-6" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
          <span className="truncate text-[13px] font-medium text-foreground" dir="auto">
            {name}
          </span>
          <time dateTime={comment.createdAt} className="shrink-0">
            {relativeTime(comment.createdAt)}
          </time>
          {canEdit && draft === null && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="ms-auto size-5.5 self-center text-muted-foreground opacity-0 transition-opacity group-hover/msg:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
              aria-label={t('edit')}
              title={t('edit')}
              onClick={() => setDraft(comment.body)}
            >
              <Pencil />
            </Button>
          )}
        </div>
        {draft !== null ? (
          <form
            className="mt-1 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void onSave(draft)
                .then(() => setDraft(null))
                .catch(() => undefined);
            }}
          >
            <DocumentCommentInput
              projectKey={projectKey}
              documentId={comment.documentId}
              autoFocus
              rows={2}
              aria-label={t('edit')}
              className="min-h-0 bg-background [box-shadow:inset_0_0_0_1px_var(--input)]"
              value={draft}
              onValueChange={setDraft}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter')
                  event.currentTarget.form?.requestSubmit();
              }}
            />
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => setDraft(null)}
              >
                {t('cancel')}
              </Button>
              <Button size="sm" className="h-7" disabled={busy || !draft.trim()}>
                {t('save')}
              </Button>
            </div>
          </form>
        ) : (
          <MarkdownEditor
            key={comment.body}
            className="mt-0.5 text-sm leading-[1.55] break-words"
            defaultValue={comment.body}
            editable={false}
          />
        )}
      </div>
    </div>
  );
}
