import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function AccountNotificationConnectButton({
  channel,
  connected,
  busy,
  onConnect,
  onDisconnect,
}: {
  channel: string;
  connected: boolean;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const t = useTranslations('account.notifications');
  const tAccounts = useTranslations('account.accounts');
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-me-3"
      disabled={busy}
      aria-label={t(connected ? 'disconnectChannel' : 'connectChannel', { channel })}
      onClick={connected ? onDisconnect : onConnect}
    >
      {tAccounts(connected ? 'disconnect' : 'connect')}
    </Button>
  );
}
