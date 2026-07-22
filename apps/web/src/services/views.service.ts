import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type View } from '@/lib/api';
import { EMPTY_FILTER_SET, type FilterSet } from '@/utils/filters';
import { normalizeSavedDisplay } from '@/utils/viewSettings';
import { useOptimisticReorder } from '@/services/optimisticReorder';
import { qk } from '@/services/queryKeys';

// Coerces a view's jsonb blobs (opaque on the server) into the client shapes,
// filling defaults for a missing/partial display or filter set. Applied by the
// views query and after a create/update so consumers always get client shapes.
export function normalizeView(v: View): View {
  const conditions = (v.filters as FilterSet | undefined)?.conditions;
  return {
    ...v,
    filters: Array.isArray(conditions) ? { conditions } : EMPTY_FILTER_SET,
    display: normalizeSavedDisplay(v.display),
  };
}

export function useViewsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.views(projectKey ?? ''),
    queryFn: () => api.listViews(projectKey!),
    enabled: projectKey != null,
    select: (rows) => rows.map(normalizeView),
  });
}

export function useCreateView(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input }: { input: Parameters<typeof api.createView>[1] }) =>
      api.createView(projectKey!, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    },
  });
}

export function useUpdateView(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof api.updateView>[1] }) =>
      api.updateView(id, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    },
  });
}

export function useDeleteView(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteView(id),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    },
  });
}

export function useReorderViews(projectKey: string | null) {
  return useOptimisticReorder<View>(projectKey ? qk.views(projectKey) : null, (orderedIds) =>
    api.reorderViews(projectKey!, orderedIds),
  );
}
