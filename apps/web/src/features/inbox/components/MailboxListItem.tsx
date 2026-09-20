import { Star } from 'lucide-react';
import type { MailMessageSummary } from '@/lib/api';
import { cn } from '@/lib/utils';
import Avatar from '@/components/common/Avatar';

function sender(message: MailMessageSummary): string {
  const from = message.from[0];
  return from?.name || from?.address || 'Unknown sender';
}

function shortDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export default function MailboxListItem({
  message,
  selected,
  pinned,
  onSelect,
  onTogglePin,
}: {
  message: MailMessageSummary;
  selected: boolean;
  pinned: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}) {
  const senderName = sender(message);

  return (
    <div
      className={cn(
        'flex w-full items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50',
        selected && 'bg-muted/80',
      )}
    >
      <button
        type="button"
        title={pinned ? 'Unpin email' : 'Pin email'}
        aria-label={pinned ? 'Unpin email' : 'Pin email'}
        onClick={onTogglePin}
        className="mt-2 shrink-0 text-muted-foreground transition-colors hover:text-yellow-400"
      >
        <Star className={cn('size-4', pinned && 'fill-yellow-400 text-yellow-400')} />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <span className="relative shrink-0">
          <Avatar
            name={senderName}
            image={message.senderAvatarUrl}
            className="size-8 text-[11px]"
          />
          {message.unread && (
            <span
              className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-primary"
              aria-label="Unread"
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn('truncate text-sm', message.unread && 'font-semibold')}>
              {senderName}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {shortDate(message.receivedAt)}
            </span>
          </span>
          <span
            className={cn(
              'mt-0.5 block truncate text-xs text-muted-foreground',
              message.unread && 'text-foreground',
            )}
          >
            {message.subject}
          </span>
        </span>
      </button>
    </div>
  );
}
