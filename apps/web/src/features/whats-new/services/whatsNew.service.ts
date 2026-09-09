'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getWhatsNew, markWhatsNewSeen } from '@/lib/api/endpoints/updates';
import { useSession } from '@/lib/auth-client';
import { qk } from '@/services/queryKeys';

// The screen shown once after an upgrade. Read once per session: the answer only
// changes when the instance restarts on a new build, which reloads the page anyway.

export function useWhatsNewQuery() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.whatsNew,
    queryFn: () => getWhatsNew(),
    // The route needs a session; the login and invite screens have none.
    enabled: Boolean(session),
    staleTime: Infinity,
  });
}

export function useMarkWhatsNewSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markWhatsNewSeen(),
    // The screen closes on click, so the write is not what the user waits for.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.whatsNew }),
  });
}
