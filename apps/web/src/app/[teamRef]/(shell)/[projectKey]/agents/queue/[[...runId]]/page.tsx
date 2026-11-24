import RunnerQueueOpenPage from '@/features/runner-queue/RunnerQueueOpenPage';

export default async function Page({ params }: { params: Promise<{ runId?: string[] }> }) {
  const id = Number((await params).runId?.[0]);
  return <RunnerQueueOpenPage runId={Number.isInteger(id) && id > 0 ? id : null} />;
}
