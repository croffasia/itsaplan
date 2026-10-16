import { useQuery } from '@tanstack/react-query';
import type { PageParams } from '@/lib/api/core/paging';
import { getRunnerQueue } from '@/lib/api/endpoints/runnerQueue';
import { qk } from './queryKeys';

export function useRunnerQueueQuery(params: PageParams) {
  return useQuery({ queryKey: [...qk.runnerQueue, params], queryFn: () => getRunnerQueue(params) });
}
