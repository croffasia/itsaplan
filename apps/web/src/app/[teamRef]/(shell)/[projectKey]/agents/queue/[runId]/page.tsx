import { redirect } from 'next/navigation';
import RunnerQueueRunPage from '@/features/runner-queue/RunnerQueueRunPage';
import { projectQueueScope } from '@/features/runner-queue/utils/queueScopes';
import { projectRefOf } from '@/utils/paths';

export default async function Page({
  params,
}: {
  params: Promise<{ teamRef: string; projectKey: string; runId: string }>;
}) {
  const { teamRef, projectKey, runId } = await params;
  const scope = projectQueueScope(projectRefOf(teamRef, projectKey));
  const id = Number(runId);
  if (!Number.isInteger(id) || id <= 0) redirect(scope.path);
  return <RunnerQueueRunPage scope={scope} runId={id} />;
}
