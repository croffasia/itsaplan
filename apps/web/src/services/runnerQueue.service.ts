import { getExternalRunTrace } from '@/lib/api/endpoints/agents';
import { useQuery } from '@tanstack/react-query';
import type { PageParams } from '@/lib/api/core/paging';
import { getRunnerQueue } from '@/lib/api/endpoints/runnerQueue';
import { qk } from './queryKeys';

export function useRunnerQueueQuery(params: PageParams) {
  return useQuery({ queryKey: [...qk.runnerQueue, params], queryFn: () => getRunnerQueue(params) });
}

export function useRunnerQueueRunQuery(runId: number | null) {
  const params = { page: 1, pageSize: 1, runId: runId ?? undefined };
  return useQuery({
    queryKey: [...qk.runnerQueue, params],
    queryFn: () => getRunnerQueue(params),
    enabled: runId != null,
  });
}

export function useExternalRunTraceQuery(runId: number, attempt?: number) {
  return useQuery({
    queryKey: [...qk.externalRunTrace(runId), attempt ?? null],
    queryFn: () => getExternalRunTrace(runId, attempt),
  });
}
