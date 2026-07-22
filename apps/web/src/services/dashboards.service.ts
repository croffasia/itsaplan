import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Dashboard } from '@/lib/api';
import { useOptimisticReorder } from '@/services/optimisticReorder';
import { qk } from '@/services/queryKeys';

export function useDashboardsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.dashboards(projectKey ?? ''),
    queryFn: () => api.listDashboards(projectKey!),
    enabled: projectKey != null,
  });
}

export function useCreateDashboard(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input }: { input: Parameters<typeof api.createDashboard>[1] }) =>
      api.createDashboard(projectKey!, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.dashboards(projectKey) });
    },
  });
}

export function useUpdateDashboard(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof api.updateDashboard>[1] }) =>
      api.updateDashboard(id, input),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.dashboards(projectKey) });
    },
  });
}

export function useDeleteDashboard(projectKey: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteDashboard(id),
    onSuccess: () => {
      if (projectKey) void qc.invalidateQueries({ queryKey: qk.dashboards(projectKey) });
    },
  });
}

export function useReorderDashboards(projectKey: string | null) {
  return useOptimisticReorder<Dashboard>(
    projectKey ? qk.dashboards(projectKey) : null,
    (orderedIds) => api.reorderDashboards(projectKey!, orderedIds),
  );
}
