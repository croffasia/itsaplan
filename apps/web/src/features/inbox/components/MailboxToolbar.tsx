import { PenLine, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MailboxToolbar({
  email,
  canSend,
  isOwner,
  refreshing,
  onCompose,
  onRefresh,
  onSettings,
}: {
  email: string;
  canSend: boolean;
  isOwner: boolean;
  refreshing: boolean;
  onCompose: () => void;
  onRefresh: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-2 border-b px-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Mail</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh"
        >
          <RefreshCw className={refreshing ? 'animate-spin' : ''} />
        </Button>
        {isOwner && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onSettings}
            title="Mailbox settings"
          >
            <Settings2 />
          </Button>
        )}
        {canSend && (
          <Button size="sm" className="ml-1 gap-1.5" onClick={onCompose}>
            <PenLine />
            Compose
          </Button>
        )}
      </div>
    </div>
  );
}
