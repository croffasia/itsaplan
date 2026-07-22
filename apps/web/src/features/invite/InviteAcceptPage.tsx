'use client';

import Link from 'next/link';
import BrandPanel from '@/components/common/page/BrandPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useInviteQuery } from './services/invite.service';
import InviteInfo from './components/InviteInfo';
import InviteNotice from './components/InviteNotice';
import InviteStep from './components/InviteStep';

// The public invite accept screen (/invite/:token). Reachable without a session:
// a logged-out invitee registers or signs in here and joins in one step; a
// logged-in one accepts or rejects directly. Styled like the auth screens.
export default function InviteAcceptPage({ token }: { token: string }) {
  const inviteQuery = useInviteQuery(token);
  const invite = inviteQuery.data;

  // The heading reflects the invite state so the copy never contradicts the body
  // (e.g. an invalid link must not read "Accept your invitation").
  let title = 'Join the project';
  let subtitle = 'Accept your invitation to start collaborating';
  let body = <p className="text-sm text-muted-foreground">Loading invite…</p>;

  if (!inviteQuery.isPending && !invite) {
    title = 'Invite not found';
    subtitle = 'This link is invalid or no longer active';
    body = (
      <InviteNotice message="This invite link is invalid or has been revoked.">
        <Button asChild variant="outline">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </InviteNotice>
    );
  } else if (invite) {
    if (invite.status !== 'pending') {
      title = 'Invitation closed';
      subtitle = `This invite was already ${invite.status}`;
    }
    body = (
      <div className="flex flex-col gap-6">
        <InviteInfo invite={invite} />
        <InviteStep token={token} invite={invite} />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            <div className="p-6 md:p-8">
              <div className="mb-6 flex flex-col gap-1 text-center">
                <h1 className="text-2xl font-bold">{title}</h1>
                <p className="text-sm text-balance text-muted-foreground">{subtitle}</p>
              </div>
              {body}
            </div>
            <BrandPanel subtitle="You have been invited to collaborate on a project." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
