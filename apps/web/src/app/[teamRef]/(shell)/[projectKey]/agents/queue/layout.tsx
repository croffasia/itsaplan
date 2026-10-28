import type { ReactNode } from 'react';
import RunnerQueuePage from '@/features/runner-queue/RunnerQueuePage';
import { projectQueueScope } from '@/features/runner-queue/utils/queueScopes';
import { projectRefOf } from '@/utils/paths';

// The run list is the layout, so it keeps its scroll and loaded pages while the open run
// changes beside it.
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ teamRef: string; projectKey: string }>;
}) {
  const { teamRef, projectKey } = await params;
  return (
    <RunnerQueuePage scope={projectQueueScope(projectRefOf(teamRef, projectKey))}>
      {children}
    </RunnerQueuePage>
  );
}
