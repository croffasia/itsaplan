'use client';

import TeamProjectsSection from '@/features/teams/components/projects/TeamProjectsSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamProjectsSection teamId={team.id} />;
}
