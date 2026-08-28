'use client';

import type { ReactNode } from 'react';
import { MessageCircle, Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatShortDate } from '@/utils/dates';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AiChatThread } from '@/lib/api';

// One conversation in the chat history list. The controls sit next to the row rather
// than inside it, so the row stays a single button. `query` is the search the list was
// filtered by: the row marks it where it appears, in the title and in the snippet the
// search brought back.
export function AiChatThreadItem({
  thread,
  active,
  query,
  onSelect,
  onToggleFavorite,
  onDelete,
}: {
  thread: AiChatThread;
  active: boolean;
  query: string;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('aiChat');
  const title = thread.title ?? t('untitledThread');

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={cn(
          'flex w-full items-start gap-2 rounded-lg py-2 pr-16 pl-2.5 text-left transition-colors',
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
          <div className="truncate text-sm">{mark(title, query)}</div>
          {thread.snippet && (
            <div className="truncate text-xs text-muted-foreground">
              {mark(thread.snippet.replace(/\s+/g, ' ').trim(), query)}
            </div>
          )}
          <div className="text-xs text-muted-foreground">{formatShortDate(thread.updatedAt)}</div>
        </div>
      </button>

      <Button
        variant="ghost"
        size="icon"
        title={t(thread.favorite ? 'removeFavorite' : 'addFavorite')}
        aria-pressed={thread.favorite}
        onClick={onToggleFavorite}
        className={cn(
          'absolute top-1/2 right-8 size-7 -translate-y-1/2 text-muted-foreground',
          !thread.favorite && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        <Star className={cn('size-3.5', thread.favorite && 'fill-current text-amber-500')} />
        <span className="sr-only">{t(thread.favorite ? 'removeFavorite' : 'addFavorite')}</span>
      </Button>

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

// The text with the first occurrence of the search marked. The search ran in the
// database, so the same query string is matched here again rather than returned.
function mark(text: string, query: string): ReactNode {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[2px] bg-primary/20 text-foreground">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}
