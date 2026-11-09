import type { ReactNode } from 'react';
import RunnerQueuePage from '@/features/runner-queue/RunnerQueuePage';
import { workspaceQueueScope } from '@/features/runner-queue/utils/queueScopes';

// The runs of every team's projects. The list is the layout, as in a project.
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <RunnerQueuePage scope={workspaceQueueScope(Number(workspaceId))}>{children}</RunnerQueuePage>
  );
}
