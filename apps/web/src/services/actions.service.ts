import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ActionDef } from '@/lib/api';
import { EMPTY_FILTER_SET, type FilterSet } from '@/utils/filters';
import { useOptimisticReorder } from '@/services/optimisticReorder';
import { qk } from '@/services/queryKeys';

// Coerces an action's jsonb blobs (opaque on the server) into the client shapes:
// a FilterSet condition (empty when missing/partial) and an effect object.
// Applied by the actions query and after a create/update.
export function normalizeAction(a: ActionDef): ActionDef {
  const conditions = (a.condition as FilterSet | undefined)?.conditions;
  return {
    ...a,
    condition: Array.isArray(conditions) ? { conditions } : EMPTY_FILTER_SET,
    effect: a.effect && typeof a.effect === 'object' ? a.effect : {},
  };
}

export function useActionsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.actions(projectKey ?? ''),
    queryFn: () => api.listActions(projectKey!),
    enabled: projectKey != null,
    select: (rows) => rows.map(normalizeAction),
  });
}

export function useCreateAction(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input }: { input: Parameters<typeof api.createAction>[1] }) =>
      api.createAction(projectKey!, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.actions(projectKey) });
    },
  });
}

export function useUpdateAction(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof api.updateAction>[1] }) =>
      api.updateAction(id, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.actions(projectKey) });
    },
  });
}

export function useDeleteAction(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteAction(id),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.actions(projectKey) });
    },
  });
}

export function useReorderActions(projectKey: string | null) {
  return useOptimisticReorder<ActionDef>(projectKey ? qk.actions(projectKey) : null, (orderedIds) =>
    api.reorderActions(projectKey!, orderedIds),
  );
}
