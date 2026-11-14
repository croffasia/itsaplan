'use client';

import { useQuery } from '@tanstack/react-query';
import { getPushConfig } from '@/lib/api/endpoints/push';
import { qk } from '@/services/queryKeys';

// Whether the instance sends Web Push. Shared rather than feature-local: the account
// page turns push on in a browser, and a project's notification preferences show the
// Push column only while the instance sends it.
export function usePushConfigQuery() {
  return useQuery({
    queryKey: qk.pushConfig,
    queryFn: () => getPushConfig(),
    // Changes only when the instance restarts with other keys.
    staleTime: 5 * 60_000,
  });
}
