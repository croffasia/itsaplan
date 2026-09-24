'use client';

import TeamInfoSection from '@/features/teams/components/info/TeamInfoSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamInfoSection teamId={team.id} />;
}
