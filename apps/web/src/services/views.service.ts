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

// The tab row: the project's views come first and the caller's private ones after; in
// each, the caller's favorites are pinned to the front and the rest keep their stored order.
export function tabOrder(views: View[]): View[] {
  return [...views].sort(
    (a, b) => Number(a.isPrivate) - Number(b.isPrivate) || Number(b.favorite) - Number(a.favorite),
  );
}

// The stored order of the dragged view's list (the project's or the caller's private
// ones) with it moved to the target's place, or to the front for a null target; null
// when nothing moves.
export function reorderedViews(
  views: View[],
  draggedId: number,
  targetId: number | null,
): View[] | null {
  const dragged = views.find((v) => v.id === draggedId);
  if (!dragged || draggedId === targetId) return null;
  const next = views
    .filter((v) => v.isPrivate === dragged.isPrivate)
    .sort((a, b) => a.position - b.position || a.id - b.id);
  const from = next.indexOf(dragged);
  const to = targetId == null ? 0 : next.findIndex((v) => v.id === targetId);
  if (to < 0 || from === to) return null;
  next.splice(from, 1);
  next.splice(to, 0, dragged);
  return next;
}

export function useViewsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.views(projectKey ?? ''),
    queryFn: () => listViews(projectKey!),
    enabled: projectKey != null,
    select: (rows) => tabOrder(rows.map(normalizeView)),
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

export function useReorderViews(projectKey: string | null) {
  return useOptimisticReorder<View>(projectKey ? qk.views(projectKey) : null, (orderedIds) =>
    reorderViews(projectKey!, orderedIds),
  );
}
