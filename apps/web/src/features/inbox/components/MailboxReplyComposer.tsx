'use client';

import { useState } from 'react';
import { ArrowUp, Paperclip, Smile, Sparkles } from 'lucide-react';
import type { MailMessage } from '@/lib/api';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMailboxAi, useSendMailboxMessage } from '../services/mailbox.service';

const QUICK_REPLIES = ['Interested!', 'Looking forward!', "Let's do it!"];

export default function MailboxReplyComposer({
  projectKey,
  message,
  folder,
  aiAssistance,
}: {
  projectKey: string;
  message: MailMessage;
  folder: string;
  aiAssistance: boolean;
}) {
  const send = useSendMailboxMessage(projectKey);
  const generate = useMailboxAi(projectKey, message.uid, folder);
  const [body, setBody] = useState('');
  const senderName = message.from[0]?.name || message.from[0]?.address || 'Sender';
  const recipient = message.replyTo[0]?.address || message.from[0]?.address || '';

  const submit = async () => {
    const text = body.trim();
    if (!text || !recipient) return;
    await send.mutateAsync({
      to: [recipient],
      subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`,
      body: text,
      inReplyTo: message.messageId ?? undefined,
      references: [...message.references, ...(message.messageId ? [message.messageId] : [])],
    });
    setBody('');
  };

  return (
    <div className="bg-background px-4 py-3 sm:px-6">
      <div className="space-y-2">
        {aiAssistance && (
          <div className="pl-11">
            <p className="text-[11px] text-muted-foreground">Quick replies</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_REPLIES.map((reply) => (
                <Button
                  key={reply}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs font-normal"
                  onClick={() => setBody(reply)}
                >
                  {reply}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-start gap-3">
          <Avatar
            name={senderName}
            image={message.senderAvatarUrl}
            className="mt-1 size-8 text-[11px]"
          />
          <div className="min-w-0 flex-1 rounded-xl bg-muted/40 p-1 shadow-sm">
            <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
              <span className="truncate">Recipient&nbsp;&nbsp;{recipient}</span>
              {aiAssistance && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-[11px] text-primary disabled:opacity-50"
                  disabled={generate.isPending}
                  onClick={() =>
                    generate.mutate('reply', { onSuccess: ({ text }) => setBody(text) })
                  }
                >
                  <Sparkles className="size-3" />
                  {generate.isPending ? 'Generating…' : 'Generate quick reply'}
                </button>
              )}
            </div>
            <div className="rounded-lg bg-background/70">
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write a reply…"
                className="min-h-20 resize-none rounded-lg border-0 bg-transparent shadow-none focus-visible:ring-0"
                maxLength={100000}
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center text-muted-foreground">
                  <Button type="button" variant="ghost" size="icon" className="size-7" disabled>
                    <Paperclip />
                    <span className="sr-only">Add attachment</span>
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-7" disabled>
                    <Smile />
                    <span className="sr-only">Add emoji</span>
                  </Button>
                </div>
                <Button
                  type="button"
                  size="icon"
                  className="size-8 rounded-full"
                  disabled={!body.trim() || !recipient || send.isPending}
                  onClick={() => void submit()}
                >
                  <ArrowUp />
                  <span className="sr-only">{send.isPending ? 'Sending reply' : 'Send reply'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
