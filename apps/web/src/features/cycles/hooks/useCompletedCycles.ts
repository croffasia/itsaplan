import type { Cycle } from '@/lib/api';
import { useCompletedCyclesQuery } from '@/services/cycles.service';

// The archive as the table reads it: the pages loaded so far as one list, how many
// finished cycles there are in all, and whether another page is worth asking for.
export interface CompletedCycles {
  items: Cycle[];
  total: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

export function useCompletedCycles(projectKey: string | null): CompletedCycles {
  const query = useCompletedCyclesQuery(projectKey);
  return {
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
    isLoading: query.isLoading,
    isLoadingMore: query.isFetchingNextPage,
    hasMore: query.hasNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
}
