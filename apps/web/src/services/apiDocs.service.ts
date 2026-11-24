'use client';

import { useQuery } from '@tanstack/react-query';
import { getApiDocsVisibility } from '@/lib/api/endpoints/settings';
import { qk } from '@/services/queryKeys';

// Whether the sidebar and the command menu show the API docs entry. God mode changes it
// rarely, so the answer is kept for a while rather than refetched per mount.
export function useApiDocsVisibilityQuery() {
  return useQuery({
    queryKey: qk.apiDocsVisibility,
    queryFn: () => getApiDocsVisibility(),
    staleTime: 5 * 60_000,
  });
}
