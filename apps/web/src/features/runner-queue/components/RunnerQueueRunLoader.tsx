import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { useRunnerQueueRunQuery } from '@/services/runnerQueue.service';

// The run of a queue, or why it is not there to show.
export default function RunnerQueueRunLoader({
  api,
  runId,
  children,
}: {
  api: string;
  runId: number;
  children: (run: RunnerQueueRun) => ReactNode;
}) {
  const t = useTranslations('issue.agentRuns');
  const query = useRunnerQueueRunQuery(api, runId);
  const run = query.isError ? null : query.data?.items[0];
  if (query.isLoading) return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  if (!run) {
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        {t('runNotFound')}
      </p>
    );
  }
  return children(run);
}
