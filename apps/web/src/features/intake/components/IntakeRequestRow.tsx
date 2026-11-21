'use client';

import { MessageSquare, Paperclip } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IntakeRequest } from '@/lib/api/endpoints/intake';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function IntakeRequestRow({
  request,
  selected,
  onSelect,
}: {
  request: IntakeRequest;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('intake');

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col gap-1 border-b px-4 py-3 text-start transition-colors hover:bg-muted/40',
        selected && 'bg-muted/70',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium" dir="auto">
          {request.title}
        </span>
        <Badge variant="outline" className="shrink-0 text-[11px]">
          {t(`status.${request.status}`)}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{request.source}</span>
        {request.externalId && (
          <span className="font-mono text-[11px]" dir="ltr">
            {request.externalId}
          </span>
        )}
        {request.submittedByName && <span dir="auto">{request.submittedByName}</span>}
        {request.commentCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3" />
            {request.commentCount}
          </span>
        )}
        {request.attachmentCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="size-3" />
            {request.attachmentCount}
          </span>
        )}
      </div>
    </button>
  );
}
