import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type HotkeyOverrides } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { qk } from '@/services/queryKeys';

// The instance keyboard shortcut overrides. Read by every client to resolve the
// bindings in effect (see context/useHotkeys); written in god mode.

export function useHotkeySettingsQuery() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.hotkeySettings,
    queryFn: () => api.getHotkeySettings(),
    // The route needs a session; the login and invite screens have none.
    enabled: Boolean(session),
    // Rarely change and are read on every screen, so keep them out of the refetch path.
    staleTime: 5 * 60_000,
  });
}

export function useInstanceHotkeySettingsQuery() {
  return useQuery({
    queryKey: qk.instanceHotkeySettings,
    queryFn: () => api.getInstanceHotkeySettings(),
  });
}

export function useUpdateInstanceHotkeySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (combos: HotkeyOverrides) => api.updateInstanceHotkeySettings(combos),
    onSuccess: (data) => {
      qc.setQueryData(qk.instanceHotkeySettings, data);
      // Every client resolves its bindings from this map, including this one.
      qc.setQueryData(qk.hotkeySettings, data);
    },
  });
}
