import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type CompetitorInput, type CompetitorPatch } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useCompetitorOverviewQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.competitorOverview(projectKey),
    queryFn: () => api.getCompetitorOverview(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useCompetitorsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.competitors(projectKey),
    queryFn: () => api.listCompetitors(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useCompetitorEventsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.competitorEvents(projectKey),
    queryFn: () => api.listCompetitorEvents(projectKey),
    enabled: projectKey.length > 0,
  });
}

function useInvalidateCompetitors(projectKey: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.competitors(projectKey) });
    void queryClient.invalidateQueries({ queryKey: qk.competitorOverview(projectKey) });
    void queryClient.invalidateQueries({ queryKey: qk.competitorEvents(projectKey) });
  };
}

export function useTrackCompetitor(projectKey: string) {
  const invalidate = useInvalidateCompetitors(projectKey);
  return useMutation({
    mutationFn: (input: CompetitorInput) => api.createCompetitor(projectKey, input),
    onSuccess: (competitor) => {
      invalidate();
      toast.success(`Tracking @${competitor.handle}`);
    },
  });
}

export function useUpdateCompetitor(projectKey: string) {
  const invalidate = useInvalidateCompetitors(projectKey);
  return useMutation({
    mutationFn: (input: { competitorId: number; patch: CompetitorPatch }) =>
      api.updateCompetitor(input.competitorId, input.patch),
    onSuccess: invalidate,
  });
}

export function useUntrackCompetitor(projectKey: string) {
  const invalidate = useInvalidateCompetitors(projectKey);
  return useMutation({
    mutationFn: (competitorId: number) => api.deleteCompetitor(competitorId),
    onSuccess: () => {
      invalidate();
      toast.success('Stopped tracking');
    },
  });
}

// A check that could not read the account is not an error the mutation should
// throw on: the API records why on the competitor and returns it, so the row shows
// the reason instead of the page showing a failure.
export function useCheckCompetitor(projectKey: string) {
  const invalidate = useInvalidateCompetitors(projectKey);
  return useMutation({
    mutationFn: (competitorId: number) => api.checkCompetitor(competitorId),
    onSuccess: (result) => {
      invalidate();
      if (!result.ok) toast.error(result.error ?? 'Could not read that account');
      else if (result.events > 0) toast.success(`${result.events} new alert(s)`);
      else toast.success('Checked, nothing changed');
    },
  });
}

export function useMarkCompetitorEventsRead(projectKey: string) {
  const invalidate = useInvalidateCompetitors(projectKey);
  return useMutation({
    mutationFn: () => api.markCompetitorEventsRead(projectKey),
    onSuccess: invalidate,
  });
}
