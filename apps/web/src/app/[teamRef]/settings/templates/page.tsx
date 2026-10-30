'use client';

import TeamTemplatesSection from '@/features/teams/components/templates/TeamTemplatesSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamTemplatesSection teamId={team.id} />;
}
