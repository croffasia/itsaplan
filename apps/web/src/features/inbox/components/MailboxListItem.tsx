import type { MailMessageSummary } from '@/lib/api';
import { cn } from '@/lib/utils';

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
  onSelect,
}: {
  message: MailMessageSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50',
        selected && 'bg-muted',
      )}
    >
      <span
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          message.unread ? 'bg-primary' : 'bg-transparent',
        )}
        aria-label={message.unread ? 'Unread' : 'Read'}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn('truncate text-sm', message.unread && 'font-semibold')}>
            {sender(message)}
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
  );
}
