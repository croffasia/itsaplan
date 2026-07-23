'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Globe, Loader2 } from 'lucide-react';
import { shareUrl } from '@/utils/paths';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// A generic public-share dialog for an issue or a saved view. It shows the current
// state (shared with a copyable link, or not shared) and toggles it through the
// enable/disable callbacks. The caller supplies the current token, the enable
// (returns the new token) and disable operations, and the path builder that turns a
// token into the public URL. Anyone with the link gets read-only access.
export default function ShareDialog({
  open,
  onOpenChange,
  title,
  token,
  enable,
  disable,
  pathForToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  token: string | null;
  enable: () => Promise<string>;
  disable: () => Promise<void>;
  pathForToken: (token: string) => string;
}) {
  const [current, setCurrent] = useState<string | null>(token);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Seed from the latest token when the dialog opens; the prop can change while it
  // is mounted (the issue/view query refetched).
  const [seed, setSeed] = useState(token);
  if (seed !== token && !busy) {
    setSeed(token);
    setCurrent(token);
  }

  const url = current ? shareUrl(pathForToken(current)) : '';

  async function onEnable() {
    setBusy(true);
    try {
      setCurrent(await enable());
    } catch {
      toast.error('Could not create the share link');
    } finally {
      setBusy(false);
    }
  }

  async function onDisable() {
    setBusy(true);
    try {
      await disable();
      setCurrent(null);
    } catch {
      toast.error('Could not stop sharing');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy the link');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Anyone with the link can view this in read-only mode, without signing in.
          </DialogDescription>
        </DialogHeader>

        {current ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={url}
                className="flex-1 text-sm"
                onFocus={(e) => e.target.select()}
              />
              <Button type="button" variant="secondary" size="sm" onClick={copy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onDisable}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Stop sharing
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Sharing is off. Create a link to let anyone view this without an account.
            </p>
            <Button type="button" disabled={busy} onClick={onEnable}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
              Create share link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
