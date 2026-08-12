'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Globe, Loader2 } from 'lucide-react';
import { shareUrl } from '@/utils/paths';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from 'next-intl';

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
  extended,
  enable,
  disable,
  pathForToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  token: string | null;
  // How much the current link exposes.
  extended: boolean;
  // Creates the link, or changes how much a live one exposes; returns its token.
  enable: (extended: boolean) => Promise<string>;
  disable: () => Promise<void>;
  pathForToken: (token: string) => string;
}) {
  const t = useTranslations('common.share');
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

  async function run(operation: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await operation();
    } catch {
      toast.error(failure);
    } finally {
      setBusy(false);
    }
  }

  const onEnable = () => run(async () => setCurrent(await enable(false)), t('createFailed'));

  const onSetExtended = (next: boolean) =>
    run(async () => setCurrent(await enable(next)), t('changeFailed'));

  const onDisable = () =>
    run(async () => {
      await disable();
      setCurrent(null);
    }, t('stopFailed'));

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('hint')}</DialogDescription>
        </DialogHeader>

        {current ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={url}
                aria-label={t('shareLink')}
                className="h-9 flex-1 bg-muted/40 font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <Button type="button" variant="secondary" size="sm" className="h-9" onClick={copy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? t('copied') : t('copy')}
              </Button>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm">{t('fullDetails')}</span>
                <span className="block text-xs text-muted-foreground">{t('fullDetailsHint')}</span>
              </span>
              <Switch
                checked={extended}
                disabled={busy}
                onCheckedChange={(next) => void onSetExtended(next)}
              />
            </label>

            <DialogFooter className="mt-1 sm:justify-start">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void onDisable()}
                className="text-muted-foreground hover:text-destructive"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {t('stopSharing')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button type="button" disabled={busy} onClick={() => void onEnable()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
              {t('createLink')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
