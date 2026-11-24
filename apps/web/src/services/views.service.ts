import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  type View,
  listViews,
  createView,
  updateView,
  deleteView,
  setViewFavorite,
  publishView,
  setViewHidden,
  arrangeTabRow,
  resetTabRow,
  reorderViews,
} from '@/lib/api/endpoints/views';
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

// The caller's tab row with the dragged view moved to the target's place, or to the
// front for a null target; null when nothing moves.
export function movedInRow(row: View[], draggedId: number, targetId: number | null): View[] | null {
  const from = row.findIndex((v) => v.id === draggedId);
  const to = targetId == null ? 0 : row.findIndex((v) => v.id === targetId);
  if (from < 0 || to < 0 || from === to) return null;
  const next = [...row];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function useViewsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.views(projectKey ?? ''),
    queryFn: () => listViews(projectKey!),
    enabled: projectKey != null,
    // The server answers in the order of the caller's own tab row.
    select: (rows) => rows.map(normalizeView),
  });
}

export function useCreateView(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input }: { input: Parameters<typeof createView>[1] }) =>
      createView(projectKey!, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    },
  });
}

export function useUpdateView(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof updateView>[1] }) =>
      updateView(id, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    },
  });
}

export function useDeleteView(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteView(id),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    },
  });
}

export function useSetViewFavorite(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: number; favorite: boolean }) =>
      setViewFavorite(id, favorite),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    },
  });
}

export function usePublishView(projectKey: string | null) {
  const t = useTranslations('views');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => publishView(id),
    onSuccess: (view) => {
      toast.success(t('published', { name: view.name }));
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    },
  });
}

export function useSetViewHidden(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) => setViewHidden(id, hidden),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    },
  });
}

export function useArrangeTabRow(projectKey: string | null) {
  return useOptimisticReorder<View>(projectKey ? qk.views(projectKey) : null, (orderedIds) =>
    arrangeTabRow(projectKey!, orderedIds),
  );
}

export function useResetTabRow(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resetTabRow(projectKey!),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    },
  });
}

// Sets the project's order, which applies to the views a person has not placed in their own
// row. The caller's own row keeps its order, so the cache waits for the server instead of
// moving the project's views ahead of it.
export function useReorderViews(projectKey: string | null) {
  const t = useTranslations('views');
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: number[]) => reorderViews(projectKey!, orderedIds),
    onSuccess: () => {
      toast.success(t('projectOrderSet'));
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.views(projectKey) });
    },
  });
}
