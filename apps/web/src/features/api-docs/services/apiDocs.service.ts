'use client';

import { useQuery } from '@tanstack/react-query';
import { getApiSpec } from '@/lib/api/endpoints/settings';
import { qk } from '@/services/queryKeys';

export function useApiSpecQuery() {
  return useQuery({
    queryKey: qk.apiSpec,
    queryFn: () => getApiSpec(),
    // The document changes only with a new release.
    staleTime: Infinity,
    retry: false,
  });
}
