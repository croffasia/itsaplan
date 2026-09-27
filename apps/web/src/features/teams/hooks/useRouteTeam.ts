import { useParams } from 'next/navigation';
import type { Team } from '@/lib/api/endpoints/teams';
import { useTeamsQuery } from '@/services/teams.service';

// The team the path names (/:teamRef/settings), by its slug or by its id. Null while
// the list loads and for a team the account is not in.
export function useRouteTeam(): Team | null {
  const { teamRef } = useParams<{ teamRef?: string }>();
  const { data } = useTeamsQuery();
  if (!teamRef) return null;
  const ref = decodeURIComponent(teamRef);
  return data?.find((team) => team.ref === ref || String(team.id) === ref) ?? null;
}
