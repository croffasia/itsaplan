import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type BraindumpEntry, type BraindumpInput, type BraindumpRouteInput } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useBraindumpConfigQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.braindumpConfig(projectKey),
    queryFn: () => api.getBraindumpConfig(projectKey),
    enabled: projectKey.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}

export function useBraindumpStatsQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.braindumpStats(projectKey),
    queryFn: () => api.getBraindumpStats(projectKey),
    enabled: projectKey.length > 0,
  });
}

// The whole stream is fetched once and filtered in the browser: a dump is small,
// the window is short, and the filter chips need the per-kind counts anyway.
export function useBraindumpEntriesQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.braindumpEntries(projectKey),
    queryFn: () => api.listBraindumpEntries(projectKey, { days: 7 }),
    enabled: projectKey.length > 0,
  });
}

function useInvalidateBraindump(projectKey: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.braindumpEntries(projectKey) });
    void queryClient.invalidateQueries({ queryKey: qk.braindumpStats(projectKey) });
  };
}

export function useCaptureBraindump(projectKey: string) {
  const invalidate = useInvalidateBraindump(projectKey);
  return useMutation({
    mutationFn: (input: BraindumpInput) => api.createBraindumpEntry(projectKey, input),
    onSuccess: () => {
      invalidate();
      toast.success('Captured');
    },
  });
}

export function useCaptureBraindumpVoice(projectKey: string) {
  const invalidate = useInvalidateBraindump(projectKey);
  return useMutation({
    mutationFn: (recording: { audio: Blob; durationSec: number }) =>
      api.createBraindumpVoiceEntry(projectKey, recording.audio, recording.durationSec),
    onSuccess: () => {
      invalidate();
      toast.success('Transcribed and captured');
    },
  });
}

export function useUpdateBraindumpEntry(projectKey: string) {
  const invalidate = useInvalidateBraindump(projectKey);
  return useMutation({
    mutationFn: (input: {
      entryId: number;
      patch: Partial<BraindumpInput> & { pinned?: boolean };
    }) => api.updateBraindumpEntry(input.entryId, input.patch),
    onSuccess: invalidate,
  });
}

export function useDeleteBraindumpEntry(projectKey: string) {
  const invalidate = useInvalidateBraindump(projectKey);
  return useMutation({
    mutationFn: (entryId: number) => api.deleteBraindumpEntry(entryId),
    onSuccess: () => {
      invalidate();
      toast.success('Dump deleted');
    },
  });
}

const ROUTED_MESSAGE: Record<BraindumpRouteInput['destination'], string> = {
  obsidian: 'Filed to your vault',
  issue: 'Converted to a work item',
  schedule: 'Scheduled',
};

export function useRouteBraindumpEntry(projectKey: string) {
  const invalidate = useInvalidateBraindump(projectKey);
  return useMutation({
    mutationFn: (input: { entryId: number; route: BraindumpRouteInput }) =>
      api.routeBraindumpEntry(input.entryId, input.route),
    onSuccess: (entry: BraindumpEntry) => {
      invalidate();
      toast.success(ROUTED_MESSAGE[entry.routedTo ?? 'obsidian']);
    },
  });
}
