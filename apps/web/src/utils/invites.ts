import type { InviteRow } from '@/lib/api/endpoints/invites';

export const isInviteExpired = (invite: Pick<InviteRow, 'expiresAt'>) =>
  invite.expiresAt != null && new Date(invite.expiresAt) < new Date();

// A renewal hands the grant out again, so the API (mayGrantInviteRanks) allows it only to
// whoever could have sent it: a team rank is the team owner's to give, and a project's
// ownership is for whoever runs the team or owns that project.
export function mayRenewInvite(
  invite: Pick<InviteRow, 'teamRole' | 'role'>,
  viewer: { teamRole: string | null; ownsProject: boolean },
): boolean {
  const runsTeam = viewer.teamRole === 'owner' || viewer.teamRole === 'manager';
  if (invite.teamRole !== 'member' && viewer.teamRole !== 'owner') return false;
  if (invite.role === 'owner' && !runsTeam && !viewer.ownsProject) return false;
  return true;
}
