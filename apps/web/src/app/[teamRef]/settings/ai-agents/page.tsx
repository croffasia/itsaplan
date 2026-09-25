'use client';

import TeamAiAgentsSection from '@/features/teams/components/ai-agents/TeamAiAgentsSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamAiAgentsSection teamId={team.id} />;
}
