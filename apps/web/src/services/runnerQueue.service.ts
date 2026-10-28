import { getExternalRunTrace } from '@/lib/api/endpoints/agents';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { nextPageParam } from '@/lib/api/core/paging';
import { DEFAULT_PAGE_SIZE } from '@/hooks/usePaging';
import {
  getInternalRunTrace,
  getRunnerQueue,
  getRunsInFlight,
} from '@/lib/api/endpoints/runnerQueue';
import { qk } from './queryKeys';

// Under the runner queue key, so the queue's live refresh reloads it with the list.
export function useRunsInFlightQuery(api: string) {
  return useQuery({
    queryKey: [...qk.runnerQueue, 'in-flight', api],
    queryFn: () => getRunsInFlight(api),
  });
}

export function useRunnerQueueQuery(api: string) {
  return useInfiniteQuery({
    queryKey: [...qk.runnerQueue, 'list', api],
    queryFn: ({ pageParam }) =>
      getRunnerQueue(api, { page: pageParam, pageSize: DEFAULT_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}

export function useRunnerQueueRunQuery(api: string, runId: number) {
  const params = { page: 1, pageSize: 1, runId };
  return useQuery({
    queryKey: [...qk.runnerQueue, api, params],
    queryFn: () => getRunnerQueue(api, params),
  });
}

export function useExternalRunTraceQuery(runId: number, attempt?: number) {
  return useQuery({
    queryKey: [...qk.externalRunTrace(runId), attempt ?? null],
    queryFn: () => getExternalRunTrace(runId, attempt),
  });
}

export function useInternalRunTraceQuery(runId: number, traceId?: string) {
  return useQuery({
    queryKey: [...qk.internalRunTrace(runId), traceId ?? null],
    queryFn: () => getInternalRunTrace(runId, traceId),
  });
}
