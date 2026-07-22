'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();

  async function switchAccount() {
    await signOut();
    router.refresh();
  }

  if (invite.status !== 'pending') {
    return (
      <InviteNotice message={`This invite has already been ${invite.status}.`}>
        <Button asChild variant="outline">
          <Link href="/">Go to the app</Link>
        </Button>
      </InviteNotice>
    );
  }

  if (sessionPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
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
      message={
        <>
          This invite was sent to{' '}
          <span className="font-medium text-foreground">{invite.email}</span>, but you are signed in
          as <span className="font-medium text-foreground">{sessionEmail}</span>. Sign out to accept
          it with the invited email.
        </>
      }
    >
      <Button variant="outline" onClick={switchAccount}>
        Sign out
      </Button>
    </InviteNotice>
  );
}
