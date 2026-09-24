'use client';

import TeamNotificationsSection from '@/features/teams/components/notifications/TeamNotificationsSection';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

export default function Page() {
  const team = useRouteTeam();
  return team && <TeamNotificationsSection teamId={team.id} />;
}
