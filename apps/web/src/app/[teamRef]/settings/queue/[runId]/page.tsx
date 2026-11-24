'use client';

import { useParams } from 'next/navigation';
import RunnerQueueRunPage from '@/features/runner-queue/RunnerQueueRunPage';
import { teamQueueScope } from '@/features/runner-queue/utils/queueScopes';
import { useRouteTeam } from '@/features/teams/hooks/useRouteTeam';

// A run id that is not a number reads as a run the queue does not hold.
export default function Page() {
  const { runId } = useParams<{ runId: string }>();
  const team = useRouteTeam();
  return team && <RunnerQueueRunPage scope={teamQueueScope(team)} runId={Number(runId)} />;
}
