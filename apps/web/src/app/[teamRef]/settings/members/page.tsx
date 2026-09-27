'use client';

import TeamMembersSection from '@/features/teams/components/members/TeamMembersSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamMembersSection teamId={team.id} />;
}
