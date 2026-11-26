'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import AccountConnectButton from '../shared/AccountConnectButton';
import AccountListSection from '../shared/AccountListSection';
import AccountServiceRow from '../shared/AccountServiceRow';
import AccountServiceMark from './AccountServiceMark';
import {
  connectGoogle,
  hasPasswordCredential,
  useDisconnectProvider,
  useLinkedAccountEmail,
  useLinkedAccountsQuery,
} from '../../services/accounts.service';

// The Google account the user signs in with. Connecting sends the browser through Google
// and back to this page; disconnecting is refused while Google is the only way left to
// sign in, since it would lock the account out.
export default function AccountGoogleConnection() {
  const t = useTranslations('account.accounts');
  const { data: accounts } = useLinkedAccountsQuery();
  const disconnect = useDisconnectProvider();
  const [connecting, setConnecting] = useState(false);

  const list = accounts ?? [];
  const google = list.find((a) => a.providerId === 'google');
  const { data: email } = useLinkedAccountEmail(google?.id);
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

  let info = t('notConnected');
  if (google) info = email ?? t('connected');

  return (
    <AccountListSection title={t('signIn')}>
      <AccountServiceRow icon={<AccountServiceMark service="google" />} name="Google" info={info}>
        {onlyWayIn ? (
          <span className="shrink-0 text-xs text-muted-foreground">{t('setPasswordFirst')}</span>
        ) : (
          <AccountConnectButton
            service="Google"
            connected={Boolean(google)}
            busy={connecting || disconnect.isPending}
            disconnectWarning={t('googleDisconnectWarning')}
            onConnect={() => void onConnect()}
            onDisconnect={async () => {
              if (!google) return;
              await disconnect.mutateAsync({ providerId: 'google', accountId: google.accountId });
              toast.success(t('googleDisconnected'));
            }}
          />
        )}
      </AccountServiceRow>
    </AccountListSection>
  );
}
