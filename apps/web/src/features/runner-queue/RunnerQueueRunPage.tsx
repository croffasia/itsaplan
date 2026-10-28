'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRunnerQueueRunQuery } from '@/services/runnerQueue.service';
import type { RunnerQueueScope } from '@/lib/api/endpoints/runnerQueue';
import { titlePath, useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/button';
import RunnerQueueRunDetail from './components/RunnerQueueRunDetail';

export default function RunnerQueueRunPage({
  scope,
  runId,
}: {
  scope: RunnerQueueScope;
  runId: number;
}) {
  const t = useTranslations('issue.agentRuns');
  const query = useRunnerQueueRunQuery(scope.api, runId);
  const run = query.isError ? null : query.data?.items[0];
  useDocumentTitle(
    titlePath(t('queueTitle'), run && (run.issueTitle ?? run.scheduleName ?? `#${run.id}`)),
  );
  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8">
      <Button asChild variant="ghost" className="mb-3 md:hidden">
        <Link href={scope.path}>{t('backToRuns')}</Link>
      </Button>
      {query.isLoading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
      {(query.isError || (query.isSuccess && !run)) && (
        <p role="alert" className="text-sm text-muted-foreground">
          {t('runNotFound')}
        </p>
      )}
      {run && <RunnerQueueRunDetail key={run.id} run={run} />}
    </div>
  );
}
