'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type InviteView } from '@/lib/api';
import { signOut, useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import InviteActions from './InviteActions';
import InviteAuthForm from './InviteAuthForm';
import InviteNotice from './InviteNotice';

// Picks what the invitee has to do next based on the invite status and the
// current session: sign in / register, accept or reject, or sign out of the
// account the invite was not sent to.
export default function InviteStep({ token, invite }: { token: string; invite: InviteView }) {
  const t = useTranslations('invite');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();

  async function switchAccount() {
    await signOut();
    router.refresh();
  }

  if (invite.status !== 'pending') {
    return (
      <InviteNotice message={t('alreadyHandled', { status: invite.status })}>
        <Button asChild variant="outline">
          <Link href="/">{t('goToApp')}</Link>
        </Button>
      </InviteNotice>
    );
  }

  if (sessionPending) {
    return <p className="text-sm text-muted-foreground">{tCommon('loading')}</p>;
  }

  if (!session) {
    return <InviteAuthForm token={token} email={invite.email} hasAccount={invite.hasAccount} />;
  }

  const sessionEmail = session.user.email;
  if (sessionEmail.toLowerCase() === invite.email.toLowerCase()) {
    return <InviteActions token={token} />;
  }

  return (
    <InviteNotice
      message={t.rich('wrongAccount', {
        email: invite.email,
        sessionEmail,
        invited: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
        current: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
      })}
    >
      <Button variant="outline" onClick={switchAccount}>
        {tCommon('signOut')}
      </Button>
    </InviteNotice>
  );
}
