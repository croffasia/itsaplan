'use client';

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
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<PasskeyRow | null>(null);

  const { data: passkeys, isPending } = usePasskeysQuery();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.passkeys });

  return (
    <FullPageView
      label="Security"
      title="Security"
      description={`How you sign in to ${session?.user.email ?? '…'}.`}
    >
      <AccountSection
        title="Password"
        description="Changing your password signs out your other sessions."
      >
        <AccountSecurityPasswordForm />
      </AccountSection>

      <AccountSection
        title="Passkeys"
        description="Sign in without a password using Touch ID, Windows Hello, or a security key."
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
