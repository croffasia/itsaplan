'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { qk } from '@/services/queryKeys';
import FullPageView from '@/components/common/page/FullPageView';
import { usePasskeysQuery, type PasskeyRow } from './services/passkeys.service';
import AccountSection from './components/AccountSection';
import AccountSecurityPasswordForm from './components/security/AccountSecurityPasswordForm';
import AccountSecurityAddPasskey from './components/security/AccountSecurityAddPasskey';
import AccountSecurityPasskeyList from './components/security/AccountSecurityPasskeyList';
import AccountSecurityDeletePasskeyDialog from './components/security/AccountSecurityDeletePasskeyDialog';

// How the account is signed in to: the password and the passkeys registered for it.
// Owns the passkey list query and the delete target; the child components refresh
// the list through the callbacks after a change.
export default function AccountSecurityPage() {
  const t = useTranslations('account.security');
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<PasskeyRow | null>(null);

  const { data: passkeys, isPending } = usePasskeysQuery();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.passkeys });

  return (
    <FullPageView
      label={t('label')}
      title={t('title')}
      description={t('description', { email: session?.user.email ?? '…' })}
    >
      <AccountSection title={t('passwordTitle')} description={t('passwordDescription')}>
        <AccountSecurityPasswordForm />
      </AccountSection>

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
