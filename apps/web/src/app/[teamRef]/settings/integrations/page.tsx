'use client';

import TeamIntegrationsSection from '@/features/teams/components/integrations/TeamIntegrationsSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamIntegrationsSection teamId={team.id} />;
}
