import { getExternalRunTrace } from '@/lib/api/endpoints/agents';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { nextPageParam } from '@/lib/api/core/paging';
import {
  getInternalRunTrace,
  getRunInitiatorOptions,
  getRunnerQueue,
  getRunProjectOptions,
  getRunsInFlight,
  type RunnerQueueFilter,
} from '@/lib/api/endpoints/runnerQueue';
import { qk } from './queryKeys';

// How many runs the history shows at first and adds with each "load older".
const RUNS_PAGE_SIZE = 15;

// Under the runner queue key, so the queue's live refresh reloads it with the list.
export function useRunsInFlightQuery(api: string) {
  return useQuery({
    queryKey: [...qk.runnerQueue, 'in-flight', api],
    queryFn: () => getRunsInFlight(api),
  });
}

// Under the runner queue key too, so a new initiator shows with the run that brings them.
export function useRunInitiatorOptionsQuery(api: string) {
  return useQuery({
    queryKey: [...qk.runnerQueue, 'initiators', api],
    queryFn: () => getRunInitiatorOptions(api),
  });
}

export function useRunProjectOptionsQuery(api: string, enabled: boolean) {
  return useQuery({
    queryKey: [...qk.runnerQueue, 'projects', api],
    queryFn: () => getRunProjectOptions(api),
    enabled,
  });
}

export function useRunnerQueueQuery(api: string, filter: RunnerQueueFilter = {}) {
  return useInfiniteQuery({
    queryKey: [...qk.runnerQueue, 'list', api, filter],
    queryFn: ({ pageParam }) =>
      getRunnerQueue(api, { page: pageParam, pageSize: RUNS_PAGE_SIZE, ...filter }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    placeholderData: keepPreviousData,
  });
}

export function useRunnerQueueRunQuery(api: string, runId: number) {
  const params = { page: 1, pageSize: 1, runId };
  return useQuery({
    queryKey: [...qk.runnerQueue, api, params],
    queryFn: () => getRunnerQueue(api, params),
  });
}

// The latest attempt without `attempt`. The previous attempt's steps stay on screen while
// the picked one loads.
export function useExternalRunTraceQuery(runId: number, attempt?: number, enabled = true) {
  return useQuery({
    queryKey: [...qk.externalRunTrace(runId), attempt ?? null],
    queryFn: () => getExternalRunTrace(runId, attempt),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useInternalRunTraceQuery(runId: number, attempt?: number, enabled = true) {
  return useQuery({
    queryKey: [...qk.internalRunTrace(runId), attempt ?? null],
    queryFn: () => getInternalRunTrace(runId, attempt),
    placeholderData: keepPreviousData,
    enabled,
  });
}
