'use client';

import { useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslations } from 'next-intl';
import type { Attachment } from '@/lib/api/endpoints/attachments';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import AttachmentPreviewFallback from './AttachmentPreviewFallback';
import { useAttachmentText } from './useAttachmentText';

const ROW_HEIGHT = 32;

export default function AttachmentCsvPreview({
  attachment,
  className,
}: {
  attachment: Attachment;
  className?: string;
}) {
  const t = useTranslations('common.attachmentPreview');
  const { data, isPending, isError } = useAttachmentText(attachment.url);
  // No delimiter is set: Papa detects it, so a TSV file parses too.
  const rows = useMemo(
    () => (data ? Papa.parse<string[]>(data, { skipEmptyLines: 'greedy' }).data : []),
    [data],
  );
  const columns = useMemo(() => rows.reduce((max, row) => Math.max(max, row.length), 0), [rows]);
  const scroller = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: Math.max(rows.length - 1, 0),
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  if (isPending) return <Skeleton className={cn('w-full', className)} />;
  if (isError) return <AttachmentPreviewFallback attachment={attachment} message={t('failed')} />;
  if (rows.length === 0)
    return <AttachmentPreviewFallback attachment={attachment} message={t('empty')} />;

  const gridTemplateColumns = `3.5rem repeat(${columns}, 12rem)`;
  const cells = (row: string[]) =>
    Array.from({ length: columns }, (_, column) => (
      <span key={column} dir="auto" title={row[column]} className="truncate border-s px-2 py-1.5">
        {row[column]}
      </span>
    ));

  return (
    <div
      ref={scroller}
      dir="ltr"
      className={cn('w-full overflow-auto rounded-md border text-xs', className)}
    >
      <div className="w-max min-w-full">
        <div
          className="sticky top-0 z-10 grid border-b bg-muted font-medium"
          style={{ gridTemplateColumns }}
        >
          <span />
          {cells(rows[0])}
        </div>
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              className="absolute inset-x-0 grid border-b"
              style={{
                gridTemplateColumns,
                height: item.size,
                transform: `translateY(${item.start}px)`,
              }}
            >
              <span className="px-2 py-1.5 text-end text-muted-foreground tabular-nums">
                {item.index + 1}
              </span>
              {cells(rows[item.index + 1])}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
