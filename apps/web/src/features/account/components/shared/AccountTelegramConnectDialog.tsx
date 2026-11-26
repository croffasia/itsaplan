'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStartTelegramLink, useTelegramAccountQuery } from '../../services/telegram.service';

// Connects the user's Telegram account. Opening the bot hands it a one-time code; the bot
// writes the connection, so the dialog has no way to know it happened except by asking
// again — it polls while the user is in the bot chat and closes once the connection appears.

const POLL_INTERVAL_MS = 2000;
// The code's own lifetime is longer; this only bounds how long the dialog keeps asking
// after a user who walked away from the flow.
const POLL_TIMEOUT_MS = 3 * 60_000;

export default function AccountTelegramConnectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('account.notifications');
  const tCommon = useTranslations('common');
  const [waiting, setWaiting] = useState(false);
  const { data } = useTelegramAccountQuery(waiting ? POLL_INTERVAL_MS : undefined);
  const start = useStartTelegramLink();
  const linked = Boolean(data?.link);

  useEffect(() => {
    if (!waiting) return;
    if (linked) {
      setWaiting(false);
      toast.success(t('telegramConnected'));
      onOpenChange(false);
      return;
    }
    const stop = setTimeout(() => setWaiting(false), POLL_TIMEOUT_MS);
    return () => clearTimeout(stop);
  }, [waiting, linked, t, onOpenChange]);

  function change(next: boolean) {
    if (!next) setWaiting(false);
    onOpenChange(next);
  }

  async function openBot() {
    // The tab is opened inside the click handler: opening it after the request
    // resolves happens outside the user gesture and the browser blocks it. The
    // reference is dropped so the bot chat cannot reach back into this page.
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const { url } = await start.mutateAsync();
      setWaiting(true);
      if (tab) tab.location.replace(url);
      else window.location.href = url;
    } catch {
      tab?.close();
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('telegramConnectTitle')}</DialogTitle>
          <DialogDescription>{t('telegramConnectHint')}</DialogDescription>
        </DialogHeader>
        <div role="status" className="empty:hidden">
          {waiting && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('telegramWaiting')}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => change(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" disabled={start.isPending} onClick={() => void openBot()}>
            {t('telegramOpen')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
