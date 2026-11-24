'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Attachment } from '@/lib/api/endpoints/attachments';
import { highlightAs } from '@/lib/highlight';
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import AttachmentPreviewFallback from './AttachmentPreviewFallback';
import { fileExtension } from './attachmentPreviewKind';
import { useAttachmentText } from './useAttachmentText';

export default function AttachmentTextPreview({
  attachment,
  markdown,
  className,
}: {
  attachment: Attachment;
  markdown: boolean;
  className?: string;
}) {
  const t = useTranslations('common.attachmentPreview');
  const { data, isPending, isError } = useAttachmentText(attachment.url);
  const html = useMemo(
    () => (markdown && data ? renderMarkdown(data, { newTabLinks: true }) : null),
    [markdown, data],
  );
  const code = useMemo(
    () => (!markdown && data ? highlightAs(fileExtension(attachment.filename), data) : null),
    [markdown, data, attachment.filename],
  );

  if (isPending) return <Skeleton className="h-40 w-full" />;
  if (isError) return <AttachmentPreviewFallback attachment={attachment} message={t('failed')} />;
  if (data.trim() === '')
    return <AttachmentPreviewFallback attachment={attachment} message={t('empty')} />;

  if (html !== null)
    return (
      <div
        dir="auto"
        className={cn('md-content w-full overflow-y-auto', className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  return (
    <div className={cn('md-content w-full overflow-auto', className)}>
      <pre>
        <code dir="ltr" className="block text-start">
          {code ?? data}
        </code>
      </pre>
    </div>
  );
}
