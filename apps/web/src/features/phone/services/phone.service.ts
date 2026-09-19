import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type PhoneCallFilters } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function usePhoneOverviewQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.phoneOverview(projectKey),
    queryFn: () => api.getPhoneOverview(projectKey),
    enabled: projectKey.length > 0,
  });
}

// Calls are read straight from Rinkel on every request, so the list is refetched
// on an interval: a call that comes in while the page is open shows up on its own.
export function usePhoneCallsQuery(projectKey: string, filters: PhoneCallFilters) {
  return useQuery({
    queryKey: qk.phoneCalls(projectKey, filters),
    queryFn: () => api.listPhoneCalls(projectKey, filters),
    enabled: projectKey.length > 0,
    refetchInterval: 30_000,
    placeholderData: (previous) => previous,
  });
}

export function usePhoneRecordingQuery(projectKey: string, numberId: string | null) {
  return useQuery({
    queryKey: qk.phoneRecording(projectKey, numberId ?? ''),
    queryFn: () => api.getPhoneRecordingSettings(projectKey, numberId!),
    enabled: projectKey.length > 0 && Boolean(numberId),
  });
}

export function useSetPhoneRecording(projectKey: string, numberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => api.setPhoneRecording(projectKey, numberId, enabled),
    onSuccess: (_result, enabled) => {
      void queryClient.invalidateQueries({ queryKey: qk.phoneRecording(projectKey, numberId) });
      toast.success(enabled ? 'Call recording is on' : 'Call recording is off');
    },
  });
}

function useInvalidateCalls(projectKey: string) {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['phoneCalls', projectKey] });
}

export function useAddPhoneCallNote(projectKey: string) {
  const invalidate = useInvalidateCalls(projectKey);
  return useMutation({
    mutationFn: (input: { callId: string; content: string }) =>
      api.addPhoneCallNote(projectKey, input.callId, input.content),
    onSuccess: () => {
      invalidate();
      toast.success('Note saved');
    },
  });
}

export function useBlockPhoneNumber(projectKey: string) {
  const invalidate = useInvalidateCalls(projectKey);
  return useMutation({
    mutationFn: (input: { number: string; reason?: string; blocked: boolean }) =>
      input.blocked
        ? api.unblockPhoneNumber(projectKey, input.number)
        : api.blockPhoneNumber(projectKey, input.number, input.reason),
    onSuccess: (_result, input) => {
      invalidate();
      toast.success(input.blocked ? 'Caller unblocked' : 'Caller blocked');
    },
  });
}

export function usePhoneDevicesQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.phoneDevices(projectKey),
    queryFn: () => api.listPhoneDevices(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useStartPhoneCall(projectKey: string) {
  return useMutation({
    mutationFn: (input: { deviceId: string; to: string; numberId: string }) =>
      api.startPhoneCall(projectKey, input),
    onSuccess: () => toast.success('Your phone is ringing — pick up to be connected'),
  });
}

// Events Rinkel pushed to the webhook endpoint. Polled on a short interval, which
// is what makes an incoming call show up while the page is open.
export function usePhoneEventsQuery(projectKey: string, since: number, enabled: boolean) {
  return useQuery({
    queryKey: qk.phoneEvents(projectKey, since),
    queryFn: () => api.listPhoneEvents(projectKey, since),
    enabled: enabled && projectKey.length > 0,
    refetchInterval: 5_000,
  });
}
