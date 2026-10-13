'use client';

import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InviteRow } from '@/lib/api/endpoints/invites';
import TeamInviteRow from './TeamInviteRow';

// The team's open invites, apart from its members: an invite is nobody yet, and one
// address can hold an invite into the team and others into its projects at once, so
// each address is listed once with what every invite of it grants.
export default function TeamInvitesList({
  invites,
  onRevoke,
  onRenew,
  canRenew,
  renewingId,
}: {
  invites: InviteRow[];
  onRevoke: (invite: InviteRow) => void;
  onRenew: (invite: InviteRow) => void;
  canRenew: (invite: InviteRow) => boolean;
  renewingId: number | null;
}) {
  const tMembers = useTranslations('members.invites');
  const byEmail = new Map<string, InviteRow[]>();
  for (const invite of invites) {
    const grants = byEmail.get(invite.email);
    if (grants) grants.push(invite);
    else byEmail.set(invite.email, [invite]);
  }

  return (
    <div>
      <div className="mb-1 border-b pb-1 text-xs font-medium text-muted-foreground">
        {tMembers('pendingCount', { count: invites.length })}
      </div>
      <div className="divide-y divide-border">
        {[...byEmail].map(([email, grants]) => (
          <div key={email} className="flex gap-2.5 py-2">
            <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Mail className="size-3.5 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{email}</p>
              {grants.map((invite) => (
                <TeamInviteRow
                  key={invite.id}
                  invite={invite}
                  onRevoke={onRevoke}
                  onRenew={canRenew(invite) ? onRenew : undefined}
                  renewing={renewingId === invite.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
