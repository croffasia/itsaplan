'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { usePaging } from '@/hooks/usePaging';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { useRunnerQueueQuery, useRunnerQueueRunQuery } from '@/services/runnerQueue.service';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { Button } from '@/components/ui/button';
import ListPager from '@/components/common/ListPager';
import RunnerQueueRow from './components/RunnerQueueRow';
import RunnerQueueListItem from './components/RunnerQueueListItem';

export default function RunnerQueuePage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const t = useTranslations('issue.agentRuns');
  const paging = usePaging();
  const query = useRunnerQueueQuery(paging.params);
  useLiveRefresh({ scope: revScope.runnerQueue, targets: [qk.runnerQueue] });
  const data = query.isError ? null : query.data;
  const detail = useRunnerQueueRunQuery(selectedId);
  const selected = detail.isError || query.isError ? null : detail.data?.items[0];
  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn(
          'flex w-full min-w-0 flex-col md:max-w-sm md:border-e',
          selected && 'hidden md:flex',
        )}
      >
        <div className="space-y-4 p-4">
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
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {data?.items.map((run) => (
            <RunnerQueueListItem
              key={run.id}
              run={run}
              selected={run.id === selectedId}
              onSelect={() => setSelectedId(run.id)}
            />
          ))}
        </div>
        {data && data.total > 0 && <ListPager paging={paging} total={data.total} />}
      </div>
      {selected ? (
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          <Button variant="ghost" className="mb-3 md:hidden" onClick={() => setSelectedId(null)}>
            {t('backToRuns')}
          </Button>
          <RunnerQueueRow key={selected.id} run={selected} />
        </div>
      ) : (
        <p className="hidden flex-1 items-center justify-center p-6 text-sm text-muted-foreground md:flex">
          {t('selectRun')}
        </p>
      )}
    </div>
  );
}
