import { getExternalRunTrace } from '@/lib/api/endpoints/agents';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { nextPageParam } from '@/lib/api/core/paging';
import { DEFAULT_PAGE_SIZE } from '@/hooks/usePaging';
import { getRunnerQueue } from '@/lib/api/endpoints/runnerQueue';
import { qk } from './queryKeys';

export function useRunnerQueueQuery() {
  return useInfiniteQuery({
    queryKey: [...qk.runnerQueue, 'list'],
    queryFn: ({ pageParam }) => getRunnerQueue({ page: pageParam, pageSize: DEFAULT_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

export function useRunnerQueueRunQuery(runId: number) {
  const params = { page: 1, pageSize: 1, runId };
  return useQuery({ queryKey: [...qk.runnerQueue, params], queryFn: () => getRunnerQueue(params) });
}

export function useExternalRunTraceQuery(runId: number, attempt?: number) {
  return useQuery({
    queryKey: [...qk.externalRunTrace(runId), attempt ?? null],
    queryFn: () => getExternalRunTrace(runId, attempt),
  });
}
