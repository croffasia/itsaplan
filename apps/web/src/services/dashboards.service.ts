import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Dashboard,
  listDashboards,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  reorderDashboards,
} from '@/lib/api/endpoints/dashboards';
import { useOptimisticReorder } from '@/services/optimisticReorder';
import { qk } from '@/services/queryKeys';

export function useDashboardsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.dashboards(projectKey ?? ''),
    queryFn: () => listDashboards(projectKey!),
    enabled: projectKey != null,
  });
}

export function useCreateDashboard(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input }: { input: Parameters<typeof createDashboard>[1] }) =>
      createDashboard(projectKey!, input),
    onSuccess: (created) => {
      if (!projectKey) return;
      qc.setQueryData<Dashboard[]>(qk.dashboards(projectKey), (current) =>
        current
          ? [...current.filter((dashboard) => dashboard.id !== created.id), created]
          : [created],
      );
      void qc.invalidateQueries({ queryKey: qk.dashboards(projectKey) });
    },
  });
}

export function useUpdateDashboard(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof updateDashboard>[1] }) =>
      updateDashboard(id, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.dashboards(projectKey) });
    },
  });
}

export function useDeleteDashboard(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteDashboard(id),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.dashboards(projectKey) });
    },
  });
}

export function useReorderDashboards(projectKey: string | null) {
  return useOptimisticReorder<Dashboard>(
    projectKey ? qk.dashboards(projectKey) : null,
    (orderedIds) => reorderDashboards(projectKey!, orderedIds),
  );
}
