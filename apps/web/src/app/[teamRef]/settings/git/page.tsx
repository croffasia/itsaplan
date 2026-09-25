'use client';

import TeamGitSection from '@/features/teams/components/integrations/TeamGitSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamGitSection teamId={team.id} />;
}
