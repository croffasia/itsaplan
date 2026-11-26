import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Connects a service, or disconnects it after the user confirms what stops working.
export default function AccountConnectButton({
  service,
  connected,
  busy,
  disconnectWarning,
  onConnect,
  onDisconnect,
}: {
  service: string;
  connected: boolean;
  busy: boolean;
  disconnectWarning: string;
  // Absent on a row that is only ever connected.
  onConnect?: () => void;
  // A failure keeps the confirmation open.
  onDisconnect: () => Promise<unknown>;
}) {
  const t = useTranslations('account.notifications');
  const tAccounts = useTranslations('account.accounts');
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          '-me-3',
          connected && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
        )}
        disabled={busy}
        aria-label={t(connected ? 'disconnectChannel' : 'connectChannel', { channel: service })}
        onClick={connected ? () => setConfirming(true) : onConnect}
      >
        {tAccounts(connected ? 'disconnect' : 'connect')}
      </Button>
      {confirming && (
        <ConfirmDialog
          title={tAccounts('disconnectTitle', { service })}
          confirmLabel={tAccounts('disconnect')}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await onDisconnect();
            setConfirming(false);
          }}
        >
          <p className="text-sm text-muted-foreground">{disconnectWarning}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
