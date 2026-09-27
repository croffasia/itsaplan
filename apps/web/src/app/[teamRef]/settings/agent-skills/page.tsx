'use client';

import TeamAgentSkillsSection from '@/features/teams/components/agent-skills/TeamAgentSkillsSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamAgentSkillsSection teamId={team.id} />;
}
