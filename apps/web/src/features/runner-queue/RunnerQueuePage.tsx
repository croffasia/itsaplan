'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Direction } from 'radix-ui';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePersistedWidth } from '@/hooks/usePersistedWidth';
import { useRunnerQueueQuery, useRunsInFlightQuery } from '@/services/runnerQueue.service';
import type { RunnerQueueRun, RunnerQueueScope } from '@/lib/api/endpoints/runnerQueue';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { Button } from '@/components/ui/button';
import ResizeGrip from '@/components/common/ResizeGrip';
import FilterChips from '@/components/common/filters/FilterChips';
import FilterMenu from '@/components/common/filters/FilterMenu';
import RunnerQueueActiveCard from './components/RunnerQueueActiveCard';
import RunnerQueueHistory from './components/RunnerQueueHistory';
import RunnerQueueOfflineNotice from './components/RunnerQueueOfflineNotice';
import RunnerQueueSearch from './components/RunnerQueueSearch';
import { useRunnerQueueFilters } from './hooks/useRunnerQueueFilters';

// The list beside a run is dragged wider than its narrowest width, which it starts at.
const LIST_MIN_W = 384;
const LIST_MAX_W = 640;

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
  const direction = Direction.useDirection();
  const { width, setWidth } = usePersistedWidth(
    'agentRuns:list:width',
    LIST_MIN_W,
    LIST_MIN_W,
    LIST_MAX_W,
  );
  const [search, setSearch] = useState('');
  const filters = useRunnerQueueFilters(scope);
  const { state, initiatorIds, projectIds } = filters;
  const q = useDebouncedValue(search.trim(), 300);
  const query = useRunnerQueueQuery(scope.api, {
    state,
    q: q || undefined,
    initiatorIds,
    projectIds,
  });
  const inFlight = useRunsInFlightQuery(scope.api).data;
  const acrossProjects = scope.acrossProjects ?? false;
  useLiveRefresh({ scope: revScope.runnerQueue, targets: [qk.runnerQueue] });
  const pages = query.isError ? undefined : query.data?.pages;
  const data = pages?.[0];
  const runs = pages?.flatMap((page) => page.items) ?? [];
  const active = runs.filter(isActive);
  const history = runs.filter((run) => !isActive(run));
  const activeCount = data ? data.queued + data.running : 0;
  const filtered = Boolean(state || q || initiatorIds.length || projectIds.length);
  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn(
          'relative flex w-full min-w-0 flex-col md:w-(--runs-list-w) md:shrink-0 md:border-e',
          selectedId != null && 'hidden md:flex',
        )}
        style={{ '--runs-list-w': `${width}px` } as CSSProperties}
      >
        <ResizeGrip
          label={t('resizeList')}
          className="absolute inset-y-0 end-0 z-10 -me-[3px] hidden md:block"
          onDrag={(deltaX) => setWidth(width + (direction === 'rtl' ? -deltaX : deltaX))}
          onReset={() => setWidth(LIST_MIN_W)}
        />
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
          <div className="flex items-center gap-1">
            <FilterMenu sections={filters.sections} onChange={filters.onChange} />
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
        </div>
        <RunnerQueueSearch value={search} onChange={setSearch} />
        <div className="px-4 pb-2 empty:hidden">
          <FilterChips sections={filters.sections} onChange={filters.onChange} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {query.isLoading && <p className="px-4 text-sm text-muted-foreground">{t('loading')}</p>}
          {query.isError && (
            <p role="alert" className="px-4 text-sm text-destructive">
              {t('loadError')}
            </p>
          )}
          {data && data.total === 0 && (
            <p className="px-4 pt-2 text-sm text-muted-foreground">
              {filtered ? t('noMatches') : t('queueEmpty')}
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
