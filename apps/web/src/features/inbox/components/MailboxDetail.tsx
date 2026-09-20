import {
  ChevronDown,
  ChevronLeft,
  File,
  MoreHorizontal,
  Reply,
  Smile,
  Sparkles,
  Star,
} from 'lucide-react';
import type { MailAddress, MailMessage } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
import { formatDateTime } from '@/utils/dates';
import { Button } from '@/components/ui/button';
import MailboxReplyComposer from './MailboxReplyComposer';
import MailboxPdfAttachment from './MailboxPdfAttachment';
import { useMailboxSummary } from '../services/mailbox.service';

function addressLabel(addresses: MailAddress[]): string {
  return addresses.map((item) => item.name || item.address).join(', ') || 'Unknown sender';
}

export default function MailboxDetail({
  projectKey,
  folder,
  message,
  loading,
  error,
  mobile,
  canReply,
  aiAssistance,
  onBack,
  onRetry,
}: {
  projectKey: string;
  folder: string;
  message: MailMessage | undefined;
  loading: boolean;
  error: boolean;
  mobile: boolean;
  canReply: boolean;
  aiAssistance: boolean;
  onBack: () => void;
  onRetry: () => void;
}) {
  const summary = useMailboxSummary(projectKey, message?.uid, folder, aiAssistance);
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

  const senderName = addressLabel(message.from);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-14 items-center gap-3 border-b px-3 sm:px-5">
        {mobile && (
          <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
            <ChevronLeft />
            <span className="sr-only">Back to messages</span>
          </Button>
        )}
        <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground" />
        <p className="truncate text-sm font-semibold">{message.subject}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 py-4 sm:px-6">
          {aiAssistance && (
            <div className="mb-5 rounded-xl bg-muted/40 px-4 py-3">
              <p className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground/80">
                <Sparkles className="size-3.5" />
                Email summary
              </p>
              {summary.data ? (
                <p className="text-xs leading-5 text-foreground/80">{summary.data.text}</p>
              ) : summary.isError ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-0 text-xs"
                  onClick={() => void summary.refetch()}
                >
                  Could not generate summary. Try again
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Generating summary…</p>
              )}
            </div>
          )}

          <div className="mb-5 flex items-start gap-3">
            <Avatar name={senderName} image={message.senderAvatarUrl} className="size-9 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{senderName}</p>
              <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                {message.from[0]?.address} <span>to me</span> <ChevronDown className="size-3" />
              </p>
            </div>
            <span className="shrink-0 pt-1 text-[11px] text-muted-foreground">
              {formatDateTime(message.receivedAt)}
            </span>
            <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
              <Button variant="ghost" size="icon" className="size-7" aria-label="Star email">
                <Star />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" aria-label="React">
                <Smile />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Reply">
                <Reply />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </div>
          </div>

          <div className="pb-8 text-sm leading-6 break-words whitespace-pre-wrap">
            {message.body}
          </div>
          {message.truncated && (
            <p className="mb-5 text-xs text-muted-foreground">
              This message was shortened for safe display.
            </p>
          )}
          {message.attachments.length > 0 && (
            <div className="border-t pt-5">
              <p className="mb-3 text-xs font-medium text-muted-foreground">Attachments</p>
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((attachment, index) =>
                  attachment.contentType === 'application/pdf' ||
                  attachment.filename.toLowerCase().endsWith('.pdf') ? (
                    <MailboxPdfAttachment
                      key={`${attachment.filename}-${index}`}
                      projectKey={projectKey}
                      folder={folder}
                      uid={message.uid}
                      index={index}
                      filename={attachment.filename}
                    />
                  ) : (
                    <div
                      key={`${attachment.filename}-${index}`}
                      className="flex items-center gap-2 rounded-md bg-muted/20 px-3 py-2 text-xs"
                    >
                      <File className="size-3.5 text-muted-foreground" />
                      <span>{attachment.filename}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {canReply && (
        <MailboxReplyComposer
          projectKey={projectKey}
          folder={folder}
          message={message}
          aiAssistance={aiAssistance}
        />
      )}
    </div>
  );
}
