'use client';

import TeamMcpSection from '@/features/teams/components/mcp/TeamMcpSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamMcpSection teamId={team.id} />;
}
