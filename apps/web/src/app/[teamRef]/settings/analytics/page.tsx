'use client';

import TeamAgentAnalyticsSection from '@/features/agent-analytics/TeamAgentAnalyticsSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamAgentAnalyticsSection teamId={team.id} />;
}
