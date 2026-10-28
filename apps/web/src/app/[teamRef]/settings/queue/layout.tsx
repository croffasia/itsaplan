'use client';

import type { ReactNode } from 'react';
import RunnerQueuePage from '@/features/runner-queue/RunnerQueuePage';
import { teamQueueScope } from '@/features/runner-queue/utils/queueScopes';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

// The runs of the team's projects. The list is the layout, as in a project.
export default function Layout({ children }: { children: ReactNode }) {
  const team = useRouteTeam();
  return team && <RunnerQueuePage scope={teamQueueScope(team)}>{children}</RunnerQueuePage>;
}
