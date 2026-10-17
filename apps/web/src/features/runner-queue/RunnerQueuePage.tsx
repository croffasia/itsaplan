'use client';

import { useTranslations } from 'next-intl';
import { usePaging } from '@/hooks/usePaging';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { useRunnerQueueQuery } from '@/services/runnerQueue.service';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { Button } from '@/components/ui/button';
import ListPager from '@/components/common/ListPager';
import RunnerQueueRow from './components/RunnerQueueRow';

export default function RunnerQueuePage() {
  const t = useTranslations('issue.agentRuns');
  const paging = usePaging();
  const query = useRunnerQueueQuery(paging.params);
  useLiveRefresh({ scope: revScope.runnerQueue, targets: [qk.runnerQueue] });
  const data = query.isError ? null : query.data;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{t('queueTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('queueDescription')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {t('refresh')}
        </Button>
      </div>
      {data && (
        <p className="text-sm">
          {t('queueCounts', { queued: data.queued, running: data.running })}
        </p>
      )}
      {query.isLoading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t('loadError')}
        </p>
      )}
      {data && data.total === 0 && (
        <p className="text-sm text-muted-foreground">{t('queueEmpty')}</p>
      )}
      {data?.items.map((run) => (
        <RunnerQueueRow key={run.id} run={run} />
      ))}
      {data && data.total > 0 && <ListPager paging={paging} total={data.total} />}
    </div>
  );
}
