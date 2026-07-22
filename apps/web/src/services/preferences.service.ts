import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AccountPreferences, type AccountPreferencesPatch } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { qk } from '@/services/queryKeys';

// The signed-in user's interface preferences. Read app-wide (the shell, the app
// root, date formatting), not only on the preferences page, so this service lives
// in the shared layer rather than in the account feature. A write returns the full
// result, which replaces the cache directly.

export const PREFERENCE_DEFAULTS: AccountPreferences = {
  timezone: 'UTC',
  theme: 'system',
  issueOpenMode: 'panel',
  startPage: 'work-items',
  showChatByDefault: false,
  lastProjectId: null,
  hotkeys: {},
};

export function useAccountPreferencesQuery() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.accountPreferences,
    queryFn: () => api.getAccountPreferences(),
    // The route needs a session; the login and invite screens have none.
    enabled: Boolean(session),
    // Rarely change and are read on every screen, so keep them out of the refetch path.
    staleTime: 5 * 60_000,
  });
}

// The preferences to render with: the saved ones once loaded, the defaults before.
// Callers never deal with an undefined value.
export function useAccountPreferences(): AccountPreferences {
  return useAccountPreferencesQuery().data ?? PREFERENCE_DEFAULTS;
}

export function useUpdateAccountPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AccountPreferencesPatch) => api.updateAccountPreferences(input),
    // Merge into the cache before the request completes: a second change made while
    // the first is still in flight is then built on the new value, not the stored
    // one, and the app (theme, timezone) reacts immediately.
    onMutate: (input) => {
      const previous = qc.getQueryData<AccountPreferences>(qk.accountPreferences);
      if (previous) qc.setQueryData(qk.accountPreferences, { ...previous, ...input });
      return { previous };
    },
    onSuccess: (data) => qc.setQueryData(qk.accountPreferences, data),
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(qk.accountPreferences, context.previous);
    },
  });
}
