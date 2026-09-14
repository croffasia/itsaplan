import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type MindFactInput, type MindFactPatch } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useMindOverviewQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.mindOverview(projectKey),
    queryFn: () => api.getMindOverview(projectKey),
    enabled: projectKey.length > 0,
  });
}

// The whole memory is fetched once and filtered in the browser: the category chips
// need their counts anyway, and a project's facts are small enough to hold.
export function useMindFactsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.mindFacts(projectKey),
    queryFn: () => api.listMindFacts(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useMindRecallsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.mindRecalls(projectKey),
    queryFn: () => api.listMindRecalls(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useStaleMindFactsQuery(projectKey: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.mindStale(projectKey),
    queryFn: () => api.listStaleMindFacts(projectKey),
    enabled: enabled && projectKey.length > 0,
  });
}

function useInvalidateMind(projectKey: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.mindFacts(projectKey) });
    void queryClient.invalidateQueries({ queryKey: qk.mindOverview(projectKey) });
    void queryClient.invalidateQueries({ queryKey: qk.mindStale(projectKey) });
  };
}

export function useRememberFact(projectKey: string) {
  const invalidate = useInvalidateMind(projectKey);
  return useMutation({
    mutationFn: (input: MindFactInput) => api.createMindFact(projectKey, input),
    onSuccess: () => {
      invalidate();
      toast.success('Remembered');
    },
  });
}

export function useUpdateMindFact(projectKey: string) {
  const invalidate = useInvalidateMind(projectKey);
  return useMutation({
    mutationFn: (input: { factId: number; patch: MindFactPatch }) =>
      api.updateMindFact(input.factId, input.patch),
    onSuccess: invalidate,
  });
}

export function useForgetMindFact(projectKey: string) {
  const invalidate = useInvalidateMind(projectKey);
  return useMutation({
    mutationFn: (factId: number) => api.deleteMindFact(factId),
    onSuccess: () => {
      invalidate();
      toast.success('Forgotten');
    },
  });
}

// Asking the memory a question is a write: the answer is recorded in the recall
// log, so the recall list and today's counter both go stale.
export function useRecallMind(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (query: string) => api.recallMind(projectKey, { query }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.mindRecalls(projectKey) });
      void queryClient.invalidateQueries({ queryKey: qk.mindOverview(projectKey) });
    },
  });
}
