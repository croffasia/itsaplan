import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CyclePatch, type NewCycleInput } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// Every cycle write changes the list and can change the cycle a detail page is
// showing.
function invalidateCycles(qc: ReturnType<typeof useQueryClient>, projectKey: string) {
  void qc.invalidateQueries({ queryKey: qk.cycles(projectKey) });
  void qc.invalidateQueries({ queryKey: qk.anyCycle });
}

// Deleting a cycle and transferring its issues both unlink issues from it. Which
// ones is not known here, so the board and the open issues are invalidated by prefix.
function invalidateCycleIssues(qc: ReturnType<typeof useQueryClient>, projectKey: string) {
  void qc.invalidateQueries({ queryKey: qk.boardIssues(projectKey) });
  void qc.invalidateQueries({ queryKey: qk.anyIssue });
}

export function useCyclesQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.cycles(projectKey ?? ''),
    queryFn: () => api.listCycles(projectKey!),
    enabled: projectKey != null,
  });
}

export function useCycleQuery(cycleId: number | null) {
  return useQuery({
    queryKey: qk.cycle(cycleId ?? -1),
    queryFn: () => api.getCycle(cycleId!),
    enabled: cycleId != null,
  });
}

export function useCreateCycle(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCycleInput) => api.createCycle(projectKey, input),
    onSuccess: () => invalidateCycles(qc, projectKey),
  });
}

export function useUpdateCycle(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: CyclePatch }) => api.updateCycle(id, patch),
    onSuccess: () => invalidateCycles(qc, projectKey),
  });
}

export function useDeleteCycle(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteCycle(id),
    onSuccess: () => {
      invalidateCycles(qc, projectKey);
      invalidateCycleIssues(qc, projectKey);
    },
  });
}

export function useTransferCycleIssues(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetCycleId }: { id: number; targetCycleId: number | null }) =>
      api.transferCycleIssues(id, targetCycleId),
    onSuccess: () => {
      invalidateCycles(qc, projectKey);
      invalidateCycleIssues(qc, projectKey);
    },
  });
}
