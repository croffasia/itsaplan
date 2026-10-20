'use client';

import { useQuery } from '@tanstack/react-query';
import { getConnectedApps } from '@/lib/api/endpoints/connectedApps';
import { qk } from '@/services/queryKeys';

export function useConnectedAppsQuery() {
  return useQuery({ queryKey: qk.connectedApps, queryFn: getConnectedApps });
}
