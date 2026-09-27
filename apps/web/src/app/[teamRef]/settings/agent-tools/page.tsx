'use client';

import TeamAgentToolsSection from '@/features/teams/components/agent-tools/TeamAgentToolsSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamAgentToolsSection teamId={team.id} />;
}
