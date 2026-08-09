import { ChevronLeft, File, Reply } from 'lucide-react';
import type { MailAddress, MailMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';

function addressLabel(addresses: MailAddress[]): string {
  return addresses.map((item) => item.name || item.address).join(', ') || 'Unknown sender';
}

export default function MailboxDetail({
  message,
  loading,
  error,
  mobile,
  canReply,
  onBack,
  onReply,
  onRetry,
}: {
  message: MailMessage | undefined;
  loading: boolean;
  error: boolean;
  mobile: boolean;
  canReply: boolean;
  onBack: () => void;
  onReply: (message: MailMessage) => void;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        Could not load this email.
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (loading || !message) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading email…
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          {mobile && (
            <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
              <ChevronLeft />
              <span className="sr-only">Back to messages</span>
            </Button>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{message.subject}</p>
            <p className="truncate text-xs text-muted-foreground">
              {addressLabel(message.from)} · {new Date(message.receivedAt).toLocaleString()}
            </p>
          </div>
        </div>
        {canReply && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onReply(message)}>
            <Reply />
            Reply
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 space-y-1 text-xs text-muted-foreground">
            <p>
              <span className="text-foreground">From:</span> {addressLabel(message.from)}
            </p>
            <p>
              <span className="text-foreground">To:</span> {addressLabel(message.to)}
            </p>
          </div>
          <div className="text-sm leading-6 break-words whitespace-pre-wrap">{message.body}</div>
          {message.truncated && (
            <p className="mt-5 text-xs text-muted-foreground">
              This message was shortened for safe display.
            </p>
          )}
          {message.attachments.length > 0 && (
            <div className="mt-8 border-t pt-5">
              <p className="mb-3 text-xs font-medium text-muted-foreground">Attachments</p>
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((attachment, index) => (
                  <div
                    key={`${attachment.filename}-${index}`}
                    className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs"
                  >
                    <File className="size-3.5 text-muted-foreground" />
                    <span>{attachment.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
