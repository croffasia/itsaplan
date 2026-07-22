'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import AccountConnectionRow from './AccountConnectionRow';
import {
  telegramAccountLabel,
  useDisconnectTelegram,
  useStartTelegramLink,
  useTelegramAccountQuery,
} from '@/services/telegram.service';

// The linked Telegram account. Connecting opens the instance bot with a one-time
// code; the bot writes the connection, so this page has no way to know it happened
// except by asking again — it polls while the user is in the bot chat and stops as
// soon as the connection appears or the code has expired.

const POLL_INTERVAL_MS = 2000;
// The code's own lifetime is longer; this only bounds how long the page keeps asking
// after a user who walked away from the flow.
const POLL_TIMEOUT_MS = 3 * 60_000;

export default function AccountTelegramConnection() {
  const [waiting, setWaiting] = useState(false);
  const { data } = useTelegramAccountQuery(waiting ? POLL_INTERVAL_MS : undefined);
  const start = useStartTelegramLink();
  const disconnect = useDisconnectTelegram();

  const link = data?.link ?? null;

  useEffect(() => {
    if (!waiting) return;
    if (link) {
      setWaiting(false);
      toast.success('Telegram connected');
      return;
    }
    const stop = setTimeout(() => setWaiting(false), POLL_TIMEOUT_MS);
    return () => clearTimeout(stop);
  }, [waiting, link]);

  async function onConnect() {
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

  // No instance bot means Telegram is not offered on this instance at all.
  if (data && !data.botUsername) return null;

  return (
    <AccountConnectionRow
      icon={<Send className="size-4" />}
      name="Telegram"
      description={
        waiting
          ? 'Waiting for you to press Start in the bot chat…'
          : 'Receive notifications in Telegram.'
      }
      connectedTo={link ? telegramAccountLabel(link) : null}
      busy={start.isPending || disconnect.isPending}
      onConnect={() => void onConnect()}
      onDisconnect={() =>
        disconnect.mutate(undefined, { onSuccess: () => toast.success('Telegram disconnected') })
      }
    />
  );
}
