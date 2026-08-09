'use client';

import { useEffect, useState } from 'react';
import type { MailMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSendMailboxMessage } from '../services/mailbox.service';

function replyRecipient(message: MailMessage): string {
  return message.replyTo[0]?.address || message.from[0]?.address || '';
}

function replySubject(subject: string): string {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

export default function MailboxComposeDialog({
  projectKey,
  open,
  reply,
  onOpenChange,
}: {
  projectKey: string;
  open: boolean;
  reply: MailMessage | null;
  onOpenChange: (open: boolean) => void;
}) {
  const send = useSendMailboxMessage(projectKey);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!open) return;
    setTo(reply ? replyRecipient(reply) : '');
    setSubject(reply ? replySubject(reply.subject) : '');
    setBody('');
  }, [open, reply]);

  const recipients = to
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await send.mutateAsync({
      to: recipients,
      subject: subject.trim(),
      body,
      inReplyTo: reply?.messageId ?? undefined,
      references: reply
        ? [...reply.references, ...(reply.messageId ? [reply.messageId] : [])]
        : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{reply ? 'Reply' : 'New email'}</DialogTitle>
            <DialogDescription>
              Sent securely through the connected Zoho SMTP account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="mail-to">To</Label>
              <Input
                id="mail-to"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="name@example.com"
                autoComplete="off"
                required
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple addresses with commas.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mail-subject">Subject</Label>
              <Input
                id="mail-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mail-body">Message</Label>
              <Textarea
                id="mail-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="min-h-56 resize-y"
                maxLength={100000}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                send.isPending || recipients.length === 0 || !subject.trim() || !body.trim()
              }
            >
              {send.isPending ? 'Sending…' : 'Send email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
