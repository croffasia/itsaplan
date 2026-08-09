import type { MailMessageSummary } from '@/lib/api';
import { Button } from '@/components/ui/button';
import MailboxListItem from './MailboxListItem';

export default function MailboxList({
  messages,
  selectedUid,
  loading,
  error,
  onSelect,
  onRetry,
}: {
  messages: MailMessageSummary[];
  selectedUid: number | null;
  loading: boolean;
  error: boolean;
  onSelect: (message: MailMessageSummary) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Syncing mail…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
        Could not sync email from Zoho.
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        No email in this inbox
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {messages.map((message) => (
        <MailboxListItem
          key={message.uid}
          message={message}
          selected={selectedUid === message.uid}
          onSelect={() => onSelect(message)}
        />
      ))}
    </div>
  );
}
