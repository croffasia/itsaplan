import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// Derived from the rest of the dashboard on every read, so it is cheap to be a
// little stale and expensive to refetch on every focus change.
export function useCommandCenterQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.commandCenter(projectKey),
    queryFn: () => api.getCommandCenter(projectKey),
    enabled: projectKey.length > 0,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useSnoozeSignal(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ signalId, hours }: { signalId: string; hours: number }) =>
      api.snoozeSignal(projectKey, signalId, hours),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.commandCenter(projectKey) }),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRestoreSignal(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (signalId: string) => api.unsnoozeSignal(projectKey, signalId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.commandCenter(projectKey) }),
    onError: (error: Error) => toast.error(error.message),
  });
}
