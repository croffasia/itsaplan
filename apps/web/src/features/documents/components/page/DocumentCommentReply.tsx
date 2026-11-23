'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import DocumentCommentInput from './DocumentCommentInput';

// The one-line reply box under an open thread. Enter sends, Shift+Enter starts a new line.
export default function DocumentCommentReply({
  projectKey,
  documentId,
  busy,
  onReply,
}: {
  projectKey: string;
  documentId: number;
  busy: boolean;
  onReply: (body: string) => Promise<void>;
}) {
  const t = useTranslations('documents.comments');
  const [body, setBody] = useState('');
  return (
    <form
      className="ms-8.5 mt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!body.trim()) return;
        void onReply(body)
          .then(() => setBody(''))
          .catch(() => undefined);
      }}
    >
      <DocumentCommentInput
        projectKey={projectKey}
        documentId={documentId}
        rows={1}
        aria-label={t('reply')}
        placeholder={t('replyPlaceholder')}
        className="min-h-8 py-1.5 text-[13px] md:text-[13px]"
        readOnly={busy}
        value={body}
        onValueChange={setBody}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
    </form>
  );
}
