import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AccountNotificationPreferences,
  type AccountNotificationPreferencesPatch,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/api/endpoints/notificationPreferences';
import { qk } from '@/services/queryKeys';

export function useNotificationPreferencesQuery() {
  return useQuery({
    queryKey: qk.notificationPreferences,
    queryFn: () => getNotificationPreferences(),
  });
}

function patched(
  current: AccountNotificationPreferences,
  patch: AccountNotificationPreferencesPatch,
): AccountNotificationPreferences {
  const next = new Map(patch.projects?.map((p) => [p.projectId, p.preferences]));
  return {
    defaults: patch.defaults ?? current.defaults,
    projects: current.projects.map((p) =>
      next.has(p.id) || patch.resetProjects ? { ...p, preferences: next.get(p.id) ?? null } : p,
    ),
  };
}

// The cache takes the change before the request completes, so the next checkbox is built
// on it. A write replaces whole sets, so the writes run one at a time, in the order they
// were made.
export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: qk.notificationPreferences,
    mutationFn: updateNotificationPreferences,
    scope: { id: 'notification-preferences' },
    onMutate: (patch) => {
      void qc.cancelQueries({ queryKey: qk.notificationPreferences });
      const previous = qc.getQueryData<AccountNotificationPreferences>(qk.notificationPreferences);
      if (previous) qc.setQueryData(qk.notificationPreferences, patched(previous, patch));
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) qc.setQueryData(qk.notificationPreferences, context.previous);
    },
    // The last write in flight reads back what is stored.
    onSettled: () => {
      if (qc.isMutating({ mutationKey: qk.notificationPreferences }) === 1)
        void qc.invalidateQueries({ queryKey: qk.notificationPreferences });
    },
  });
}
