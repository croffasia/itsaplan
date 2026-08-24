import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CyclePatch, type NewCycleInput } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// How many finished cycles the archive loads at a time.
const COMPLETED_CYCLES_PAGE = 25;

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

// What the cycles page lists, and what the pickers offer: the cycles that have not
// finished. The whole list (useCyclesQuery) stays for the cycle form, which needs the
// finished ones too — to name a cycle after the last one and to keep dates off an
// existing range.
export function usePlannedCyclesQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.plannedCycles(projectKey ?? ''),
    queryFn: () => api.listPlannedCycles(projectKey!),
    enabled: projectKey != null,
  });
}

// The cycles an issue can be planned into. Read under work items, so the picker and
// the board's cycle lanes work for a role without access to the cycles pages.
export function useCycleOptionsQuery(projectKey: string | null) {
  return useQuery({
    queryKey: qk.cycleOptions(projectKey ?? ''),
    queryFn: () => api.listCycleOptions(projectKey!),
    enabled: projectKey != null,
  });
}

// The finished cycles, newest first, a page at a time.
export function useCompletedCyclesQuery(projectKey: string | null) {
  return useInfiniteQuery({
    queryKey: qk.completedCycles(projectKey ?? ''),
    queryFn: ({ pageParam }) =>
      api.listCompletedCycles(projectKey!, { page: pageParam, pageSize: COMPLETED_CYCLES_PAGE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined,
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

// Finishing a cycle takes it out of the planned list and the pickers, and starting
// the next one also moves issues between cycles.
export function useFinishCycle(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.finishCycle(id),
    onSuccess: () => invalidateCycles(qc, projectKey),
  });
}

export function useStartNextCycle(projectKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.startNextCycle(id),
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
