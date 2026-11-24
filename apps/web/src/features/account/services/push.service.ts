'use client';

import { useQuery } from '@tanstack/react-query';
import { getPushConfig, listPushDevices } from '@/lib/api/endpoints/push';
import { qk } from '@/services/queryKeys';

// Whether the instance sends Web Push.
export function usePushConfigQuery() {
  return useQuery({
    queryKey: qk.pushConfig,
    queryFn: () => getPushConfig(),
    // Changes only when the instance restarts with other keys.
    staleTime: 5 * 60_000,
  });
}

// The browsers the signed-in user turned push on in.
export function usePushDevicesQuery(enabled: boolean) {
  return useQuery({ queryKey: qk.pushDevices, queryFn: () => listPushDevices(), enabled });
}
