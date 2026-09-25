'use client';

import TeamRolesSection from '@/features/teams/components/roles/TeamRolesSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamRolesSection teamId={team.id} />;
}
