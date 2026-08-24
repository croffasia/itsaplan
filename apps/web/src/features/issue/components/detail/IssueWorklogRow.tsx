'use client';

import { Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type Worklog } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/estimate';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';

// One logged entry: who logged it, how long they worked, the day it was spent on
// and their note. The two controls show only to whoever may touch this entry —
// its author, or a member who may delete work items.
export default function IssueWorklogRow({
  entry,
  canEdit,
  onEdit,
  onRemove,
}: {
  entry: Worklog;
  canEdit: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('issue.worklog');
  const name = entry.userName ?? '';

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
      <Avatar name={name} image={entry.userImage} />
      <span className="shrink-0 text-sm font-medium tabular-nums">
        {formatMinutes(entry.minutes)}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatShortDate(entry.spentOn)}
      </span>
      {entry.note && (
        <span dir="auto" className="min-w-0 truncate text-sm text-muted-foreground">
          {entry.note}
        </span>
      )}
      <span className="ms-auto shrink-0 text-xs text-muted-foreground">{name}</span>

      {canEdit && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
            aria-label={t('edit')}
            onClick={onEdit}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
            aria-label={t('remove')}
            onClick={onRemove}
          >
            <X className="size-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}
