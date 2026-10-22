import { redirect } from 'next/navigation';
import RunnerQueueRunPage from '@/features/runner-queue/RunnerQueueRunPage';
import { projectRefOf, runnerQueuePath } from '@/utils/paths';

export default async function Page({
  params,
}: {
  params: Promise<{ teamRef: string; projectKey: string; runId: string }>;
}) {
  const { teamRef, projectKey, runId } = await params;
  const queuePath = runnerQueuePath(projectRefOf(teamRef, projectKey));
  const id = Number(runId);
  if (!Number.isInteger(id) || id <= 0) redirect(queuePath);
  return <RunnerQueueRunPage runId={id} queuePath={queuePath} />;
}
