import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAgentSchedules,
  listAgentScheduleRuns,
  createAgentSchedule,
  updateAgentSchedule,
  deleteAgentSchedule,
  cancelAgentScheduleRuns,
  runAgentSchedule,
} from '@/lib/api/endpoints/agentSchedules';
import type { PageParams } from '@/lib/api/core/paging';
import { qk } from '@/services/queryKeys';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { usePermissions } from '@/hooks/usePermissions';
import { revScope } from '@/utils/revScopes';

// One page of the project's schedules. A page with a run still going is polled, so the
// row's status catches up on its own.
export function useAgentSchedules(projectKey: string, params: PageParams) {
  return useQuery({
    queryKey: qk.agentSchedulePage(projectKey, params),
    queryFn: () => listAgentSchedules(projectKey, params),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some((schedule) => schedule.lastRunStatus === 'pending')
        ? 2000
        : false,
  });
}

// The runner queue's marker names the agents and their runners, so it goes to readers of the
// agents only. Anyone else polls.
export function useAgentScheduleRuns(projectKey: string, scheduleId: number | null) {
  const { can } = usePermissions();
  const readsAgents = can('ai_agents', 'read');
  useLiveRefresh({
    scope: scheduleId == null ? null : revScope.runnerQueue,
    targets: [qk.agentScheduleRuns(projectKey, scheduleId ?? 0)],
    enabled: readsAgents,
  });
  return useQuery({
    queryKey: qk.agentScheduleRuns(projectKey, scheduleId ?? 0),
    queryFn: () => listAgentScheduleRuns(projectKey, scheduleId!),
    enabled: scheduleId != null,
    refetchInterval: readsAgents ? false : 5_000,
  });
}

export function useCreateAgentSchedule(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createAgentSchedule>[1]) =>
      createAgentSchedule(projectKey, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.agentSchedules(projectKey) }),
  });
}

export function useUpdateAgentSchedule(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof updateAgentSchedule>[2] }) =>
      updateAgentSchedule(projectKey, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.agentSchedules(projectKey) }),
  });
}

export function useDeleteAgentSchedule(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAgentSchedule(projectKey, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.agentSchedules(projectKey) }),
  });
}

export function useCancelAgentScheduleRuns(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scheduleId, runId }: { scheduleId: number; runId?: number }) =>
      cancelAgentScheduleRuns(projectKey, scheduleId, runId),
    onSuccess: (_data, { scheduleId }) => {
      void qc.invalidateQueries({ queryKey: qk.agentSchedules(projectKey) });
      void qc.invalidateQueries({ queryKey: qk.agentScheduleRuns(projectKey, scheduleId) });
    },
  });
}

export function useRunAgentSchedule(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => runAgentSchedule(projectKey, id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: qk.agentSchedules(projectKey) });
      void qc.invalidateQueries({ queryKey: qk.agentScheduleRuns(projectKey, id) });
    },
  });
}
