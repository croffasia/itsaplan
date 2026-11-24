import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useRunnerQueueQuery } from '@/services/runnerQueue.service';
import type { RunnerQueueRun, RunnerQueueScope } from '@/lib/api/endpoints/runnerQueue';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { Button } from '@/components/ui/button';
import FilterChips from '@/components/common/filters/FilterChips';
import FilterMenu from '@/components/common/filters/FilterMenu';
import { useRunnerQueueFilters } from '../hooks/useRunnerQueueFilters';
import RunnerQueueActive from './RunnerQueueActive';
import RunnerQueueHistory from './RunnerQueueHistory';
import RunnerQueueSearch from './RunnerQueueSearch';
import RunnerQueueStateFilter from './RunnerQueueStateFilter';

const isActive = (run: RunnerQueueRun) =>
  run.executionState === 'queued' || run.executionState === 'running';

// The runs of a scope, the active ones first, under their search and filters.
export default function RunnerQueueList({
  scope,
  selectedId,
}: {
  scope: RunnerQueueScope;
  selectedId: number | null;
}) {
  const t = useTranslations('issue.agentRuns');
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
  useLiveRefresh({ scope: revScope.runnerQueue, targets: [qk.runnerQueue] });
  const pages = query.isError ? undefined : query.data?.pages;
  const data = pages?.[0];
  const runs = pages?.flatMap((page) => page.items) ?? [];
  const acrossProjects = scope.acrossProjects ?? false;
  const filtered = Boolean(state || q || initiatorIds.length || projectIds.length);

  return (
    <>
      <div className="flex items-center gap-1 ps-4 pe-3 pt-3 pb-2">
        <RunnerQueueSearch value={search} onChange={setSearch} />
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
      <RunnerQueueStateFilter
        value={state}
        active={data && data.queued + data.running}
        failed={data?.failed}
        onChange={filters.setState}
      />
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
        <RunnerQueueActive scope={scope} runs={runs.filter(isActive)} selectedId={selectedId} />
        <RunnerQueueHistory
          runs={runs.filter((run) => !isActive(run))}
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
    </>
  );
}
