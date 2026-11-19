'use client';

import { useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useRunnerQueueQuery, useRunsInFlightQuery } from '@/services/runnerQueue.service';
import type {
  RunnerQueueRun,
  RunnerQueueScope,
  RunnerQueueState,
} from '@/lib/api/endpoints/runnerQueue';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { Button } from '@/components/ui/button';
import RunnerQueueActiveCard from './components/RunnerQueueActiveCard';
import RunnerQueueFilters from './components/RunnerQueueFilters';
import RunnerQueueHistory from './components/RunnerQueueHistory';
import RunnerQueueOfflineNotice from './components/RunnerQueueOfflineNotice';

const isActive = (run: RunnerQueueRun) =>
  run.executionState === 'queued' || run.executionState === 'running';

export default function RunnerQueuePage({
  scope,
  children,
}: {
  scope: RunnerQueueScope;
  children: ReactNode;
}) {
  const params = useParams<{ runId?: string }>();
  const selectedId = params.runId ? Number(params.runId) : null;
  const t = useTranslations('issue.agentRuns');
  const [state, setState] = useState<RunnerQueueState>();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const query = useRunnerQueueQuery(scope.api, { state, q: q || undefined });
  const inFlight = useRunsInFlightQuery(scope.api).data;
  const acrossProjects = scope.acrossProjects ?? false;
  useLiveRefresh({ scope: revScope.runnerQueue, targets: [qk.runnerQueue] });
  const pages = query.isError ? undefined : query.data?.pages;
  const data = pages?.[0];
  const runs = pages?.flatMap((page) => page.items) ?? [];
  const active = runs.filter(isActive);
  const history = runs.filter((run) => !isActive(run));
  const activeCount = data ? data.queued + data.running : 0;
  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn(
          'flex w-full min-w-0 flex-col md:max-w-sm md:border-e',
          selectedId != null && 'hidden md:flex',
        )}
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold">{t('queueTitle')}</h1>
            {inFlight && (
              <p className="text-xs text-muted-foreground">
                {inFlight.limit > 0
                  ? t('internalInFlight', { running: inFlight.running, limit: inFlight.limit })
                  : t('internalInFlightNoLimit', { running: inFlight.running })}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('refresh')}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw />
          </Button>
        </div>
        <RunnerQueueFilters
          state={state}
          onStateChange={setState}
          search={search}
          onSearchChange={setSearch}
          failed={data?.failed ?? 0}
          active={activeCount}
        />
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {query.isLoading && <p className="px-4 text-sm text-muted-foreground">{t('loading')}</p>}
          {query.isError && (
            <p role="alert" className="px-4 text-sm text-destructive">
              {t('loadError')}
            </p>
          )}
          {data && data.total === 0 && (
            <p className="px-4 pt-2 text-sm text-muted-foreground">
              {state || q ? t('noMatches') : t('queueEmpty')}
            </p>
          )}
          <RunnerQueueOfflineNotice runs={active} />
          {active.length > 0 && (
            <section>
              <h2 className="flex justify-between px-4 pt-4 pb-1 text-xs font-semibold text-muted-foreground">
                {t('activeSection')}
                <span>{activeCount}</span>
              </h2>
              <div className="space-y-2 px-3 pt-1">
                {active.map((run) => (
                  <RunnerQueueActiveCard
                    key={run.id}
                    run={run}
                    href={`${scope.path}/${run.id}`}
                    selected={run.id === selectedId}
                    acrossProjects={acrossProjects}
                  />
                ))}
              </div>
            </section>
          )}
          <RunnerQueueHistory
            runs={history}
            path={scope.path}
            selectedId={selectedId}
            acrossProjects={acrossProjects}
          />
          {query.hasNextPage && (
            <div className="px-4 pt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {t('loadMore')}
              </Button>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
