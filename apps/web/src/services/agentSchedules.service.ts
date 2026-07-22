import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useAgentSchedules(projectKey: string) {
  return useQuery({
    queryKey: qk.agentSchedules(projectKey),
    queryFn: () => api.listAgentSchedules(projectKey),
    refetchInterval: (query) =>
      query.state.data?.some((schedule) => schedule.lastRunStatus === 'pending') ? 2000 : false,
  });
}

export function useAgentScheduleRuns(projectKey: string, scheduleId: number | null) {
  return useQuery({
    queryKey: qk.agentScheduleRuns(projectKey, scheduleId ?? 0),
    queryFn: () => api.listAgentScheduleRuns(projectKey, scheduleId!),
    enabled: scheduleId != null,
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === 'pending') ? 2000 : false,
  });
}

export function useCreateAgentSchedule(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.createAgentSchedule>[1]) =>
      api.createAgentSchedule(projectKey, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.agentSchedules(projectKey) }),
  });
}

export function useUpdateAgentSchedule(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: Parameters<typeof api.updateAgentSchedule>[2];
    }) => api.updateAgentSchedule(projectKey, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.agentSchedules(projectKey) }),
  });
}

export function useDeleteAgentSchedule(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteAgentSchedule(projectKey, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.agentSchedules(projectKey) }),
  });
}

export function useRunAgentSchedule(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.runAgentSchedule(projectKey, id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: qk.agentSchedules(projectKey) });
      void qc.invalidateQueries({ queryKey: qk.agentScheduleRuns(projectKey, id) });
    },
  });
}
