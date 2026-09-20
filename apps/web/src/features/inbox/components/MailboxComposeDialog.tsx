'use client';

import { useEffect, useState } from 'react';
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

export default function MailboxComposeDialog({
  projectKey,
  open,
  onOpenChange,
}: {
  projectKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const send = useSendMailboxMessage(projectKey);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!open) return;
    setTo('');
    setSubject('');
    setBody('');
  }, [open]);

  const recipients = to
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await send.mutateAsync({ to: recipients, subject: subject.trim(), body });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New email</DialogTitle>
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
