'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import GoogleIcon from '@/components/common/GoogleIcon';
import AccountConnectionRow from './AccountConnectionRow';
import {
  connectGoogle,
  hasPasswordCredential,
  useDisconnectProvider,
  useLinkedAccountsQuery,
} from '../../services/accounts.service';

// Connecting sends the browser through Google and back to this page; disconnecting
// is refused while Google is the only way left to sign in, since it would lock the
// account out.
export default function AccountGoogleConnection() {
  const t = useTranslations('account.accounts');
  const { data: accounts } = useLinkedAccountsQuery();
  const disconnect = useDisconnectProvider();
  const [connecting, setConnecting] = useState(false);

  const list = accounts ?? [];
  const google = list.find((a) => a.providerId === 'google');
  // Passkeys are a sign-in method too, but they are managed on another page and can
  // be removed there; the password is the one this page can reason about.
  const onlyWayIn = Boolean(google) && !hasPasswordCredential(list) && list.length === 1;

  async function onConnect() {
    setConnecting(true);
    try {
      await connectGoogle(t('connectFailed'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('googleConnectFailed'));
    } finally {
      // Normally the browser has left for Google by now; releasing the button
      // anyway keeps a call that returned without navigating from locking it.
      setConnecting(false);
    }
  }

  return (
    <AccountConnectionRow
      icon={<GoogleIcon className="size-4" />}
      name="Google"
      description={t('googleDescription')}
      connectedTo={google ? t('connected') : null}
      busy={connecting || disconnect.isPending}
      disconnectHint={onlyWayIn ? t('setPasswordFirst') : undefined}
      onConnect={() => void onConnect()}
      onDisconnect={() => {
        if (!google) return;
        disconnect.mutate(
          { providerId: 'google', accountId: google.accountId },
          { onSuccess: () => toast.success(t('googleDisconnected')) },
        );
      }}
    />
  );
}
