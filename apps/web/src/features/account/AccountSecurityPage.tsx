'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { qk } from '@/services/queryKeys';
import FullPageView from '@/components/common/page/FullPageView';
import type { ConnectedApp } from '@/lib/api/endpoints/connectedApps';
import { hasPasswordCredential, useLinkedAccountsQuery } from './services/accounts.service';
import { usePasskeysQuery, type PasskeyRow } from './services/passkeys.service';
import { useConnectedAppsQuery } from './services/connectedApps.service';
import AccountSection from './components/AccountSection';
import AccountSecurityPasswordForm from './components/security/AccountSecurityPasswordForm';
import AccountSecurityAddPasskey from './components/security/AccountSecurityAddPasskey';
import AccountSecurityPasskeyList from './components/security/AccountSecurityPasskeyList';
import AccountSecurityDeletePasskeyDialog from './components/security/AccountSecurityDeletePasskeyDialog';
import AccountSecurityConnectedApps from './components/security/AccountSecurityConnectedApps';
import AccountSecurityDisconnectAppDialog from './components/security/AccountSecurityDisconnectAppDialog';

// How the account is signed in to: the password and the passkeys registered for it,
// and the applications it let in through OAuth (MCP clients).
// Owns the passkey list query and the delete target; the child components refresh
// the list through the callbacks after a change.
export default function AccountSecurityPage() {
  const t = useTranslations('account.security');
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<PasskeyRow | null>(null);
  const [disconnecting, setDisconnecting] = useState<ConnectedApp | null>(null);
  const { data: linkedAccounts } = useLinkedAccountsQuery();
  // An account created through single sign-on has no password to change; while the
  // list loads the form stays, as it does when the list cannot be read.
  const canChangePassword = !linkedAccounts || hasPasswordCredential(linkedAccounts);

  const { data: passkeys, isPending } = usePasskeysQuery();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.passkeys });
  const { data: connectedApps, isPending: connectedAppsPending } = useConnectedAppsQuery();

  return (
    <FullPageView
      label={t('label')}
      title={t('title')}
      description={t('description', { email: session?.user.email ?? '…' })}
    >
      {canChangePassword && (
        <AccountSection title={t('passwordTitle')} description={t('passwordDescription')}>
          <AccountSecurityPasswordForm />
        </AccountSection>
      )}

      <AccountSection
        title={t('passkeysTitle')}
        description={t('passkeysDescription')}
        actions={<AccountSecurityAddPasskey onAdded={invalidate} />}
      >
        <AccountSecurityPasskeyList
          passkeys={passkeys ?? []}
          isPending={isPending}
          onDelete={setDeleting}
        />
      </AccountSection>

      <AccountSection title={t('connectedAppsTitle')} description={t('connectedAppsDescription')}>
        <AccountSecurityConnectedApps
          apps={connectedApps ?? []}
          isPending={connectedAppsPending}
          onDisconnect={setDisconnecting}
        />
      </AccountSection>

      {disconnecting && (
        <AccountSecurityDisconnectAppDialog
          app={disconnecting}
          onClose={() => setDisconnecting(null)}
          onDisconnected={async () => {
            setDisconnecting(null);
            await queryClient.invalidateQueries({ queryKey: qk.connectedApps });
          }}
        />
      )}

      {deleting && (
        <AccountSecurityDeletePasskeyDialog
          passkey={deleting}
          accountEmail={session?.user.email}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null);
            await invalidate();
          }}
        />
      )}
    </FullPageView>
  );
}
