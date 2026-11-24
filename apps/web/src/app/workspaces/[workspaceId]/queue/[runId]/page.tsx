import { redirect } from 'next/navigation';
import RunnerQueueRunPage from '@/features/runner-queue/RunnerQueueRunPage';
import { workspaceQueueScope } from '@/features/runner-queue/utils/queueScopes';

export default async function Page({
  params,
}: {
  params: Promise<{ workspaceId: string; runId: string }>;
}) {
  const { workspaceId, runId } = await params;
  const scope = workspaceQueueScope(Number(workspaceId));
  const id = Number(runId);
  if (!Number.isInteger(id) || id <= 0) redirect(scope.path);
  return <RunnerQueueRunPage scope={scope} runId={id} />;
}
