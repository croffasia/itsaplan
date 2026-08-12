'use client';

import { MessageCircle, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatShortDate } from '@/utils/dates';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AiChatThread } from '@/lib/api';

// One conversation in the chat history list. The delete control sits next to the row
// rather than inside it, so the row stays a single button.
export function AiChatThreadItem({
  thread,
  active,
  onSelect,
  onDelete,
}: {
  thread: AiChatThread;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('aiChat');

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={cn(
          'flex w-full items-start gap-2 rounded-lg py-2 pr-9 pl-2.5 text-left transition-colors',
          active ? 'bg-accent' : 'hover:bg-accent/50',
        )}
      >
        <MessageCircle
          className={cn(
            'mt-0.5 size-3.5 shrink-0',
            active ? 'text-foreground' : 'text-muted-foreground',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{thread.title ?? t('untitledThread')}</div>
          <div className="text-xs text-muted-foreground">{formatShortDate(thread.updatedAt)}</div>
        </div>
      </button>

      <Button
        variant="ghost"
        size="icon"
        title={t('deleteThread')}
        onClick={onDelete}
        className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">{t('deleteThread')}</span>
      </Button>
    </div>
  );
}
