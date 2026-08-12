'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { qk } from '@/services/queryKeys';

// The running version and the upstream release check behind the sidebar footer.
// The version is read by every signed-in user; the check is owner-only, so the
// query is disabled for everyone else instead of asking and taking a 403.

export function useAppVersionQuery() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.appVersion,
    queryFn: () => api.getAppVersion(),
    // The route needs a session; the login and invite screens have none.
    enabled: Boolean(session),
    // Fixed for the life of the process: it only changes when the instance restarts
    // on a new build, which reloads the page anyway.
    staleTime: Infinity,
  });
}

export function useUpdateStatusQuery(enabled: boolean) {
  return useQuery({
    queryKey: qk.updateStatus,
    queryFn: () => api.getUpdateStatus(),
    enabled,
    // Every call reads the upstream feed, so this is the only thing keeping a
    // session from doing it on each navigation. "Check now" refetches regardless.
    staleTime: 30 * 60_000,
  });
}

export function useCheckForUpdates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.checkForUpdates(),
    onSuccess: (data) => qc.setQueryData(qk.updateStatus, data),
  });
}
