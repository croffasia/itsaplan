'use client';

import { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useIsMac } from '@/context/useHotkeys';
import DocumentCommentInput from './DocumentCommentInput';

// The first message of a new thread on the selected text.
export default function DocumentCommentDraft({
  projectKey,
  documentId,
  quote,
  failed,
  busy,
  onSubmit,
  onCancel,
}: {
  projectKey: string;
  documentId: number;
  quote: string;
  failed: boolean;
  busy: boolean;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('documents.comments');
  const isMac = useIsMac();
  const [body, setBody] = useState('');

  return (
    <form
      className="flex flex-col gap-2.5 rounded-xl bg-card p-3 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim()) onSubmit(body);
      }}
    >
      <span
        className="line-clamp-2 rounded-md bg-ring/20 px-2.5 py-1 text-[13px] leading-[1.45] text-muted-foreground"
        dir="auto"
      >
        {quote}
      </span>
      <DocumentCommentInput
        projectKey={projectKey}
        documentId={documentId}
        autoFocus
        rows={2}
        aria-label={t('add')}
        placeholder={t('placeholder')}
        value={body}
        onValueChange={setBody}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      {failed && (
        <p
          role="alert"
          className="flex items-start gap-2 text-[13px] leading-[1.45] text-destructive"
        >
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{t('failed')}</span>
        </p>
      )}
      <div className="flex items-center gap-1.5">
        <span className="me-auto text-xs text-muted-foreground">
          {t('composerHint', { key: isMac ? '⌘' : 'Ctrl' })}
        </span>
        <Button type="button" variant="ghost" size="sm" className="h-7" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button size="sm" className="h-7" disabled={busy || !body.trim()}>
          {failed ? t('retry') : t('add')}
        </Button>
      </div>
    </form>
  );
}
