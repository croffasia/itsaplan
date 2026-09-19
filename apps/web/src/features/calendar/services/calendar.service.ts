import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type CalendarEventInput } from '@/lib/api';
import { qk } from '@/services/queryKeys';

export function useCalendarConnectionQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.calendarConnection(projectKey),
    queryFn: () => api.getCalendarConnection(projectKey),
    enabled: projectKey.length > 0,
  });
}

export function useCalendarsQuery(projectKey: string, connected: boolean) {
  return useQuery({
    queryKey: qk.calendarCalendars(projectKey),
    queryFn: () => api.listCalendars(projectKey),
    enabled: projectKey.length > 0 && connected,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// Every window is one round trip to Google, so a window already fetched is reused
// while the view moves back and forth over the same weeks.
export function useCalendarEventsQuery(
  projectKey: string,
  from: string,
  to: string,
  connected: boolean,
) {
  return useQuery({
    queryKey: qk.calendarEvents(projectKey, from, to),
    queryFn: () => api.listCalendarEvents(projectKey, from, to),
    enabled: projectKey.length > 0 && connected,
    staleTime: 60_000,
    retry: false,
  });
}

function useInvalidateCalendar(projectKey: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['calendarEvents', projectKey] });
    void queryClient.invalidateQueries({ queryKey: qk.calendarConnection(projectKey) });
    void queryClient.invalidateQueries({ queryKey: qk.calendarCalendars(projectKey) });
  };
}

// Google is asked for the consent URL first, so a missing OAuth client or a denied
// permission is a message on this page rather than an error screen at Google.
export function useStartCalendarConnect(projectKey: string) {
  return useMutation({
    mutationFn: () => api.startCalendarConnect(projectKey),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDisconnectCalendar(projectKey: string) {
  const invalidate = useInvalidateCalendar(projectKey);
  return useMutation({
    mutationFn: () => api.disconnectCalendar(projectKey),
    onSuccess: () => {
      invalidate();
      toast.success('Google Calendar disconnected');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetHiddenCalendars(projectKey: string) {
  const invalidate = useInvalidateCalendar(projectKey);
  return useMutation({
    mutationFn: (hiddenCalendarIds: string[]) =>
      api.setHiddenCalendars(projectKey, hiddenCalendarIds),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateCalendarEvent(projectKey: string) {
  const invalidate = useInvalidateCalendar(projectKey);
  return useMutation({
    mutationFn: (input: CalendarEventInput) => api.createCalendarEvent(projectKey, input),
    onSuccess: () => {
      invalidate();
      toast.success('Event added to Google Calendar');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateCalendarEvent(projectKey: string) {
  const invalidate = useInvalidateCalendar(projectKey);
  return useMutation({
    mutationFn: ({ eventId, input }: { eventId: string; input: CalendarEventInput }) =>
      api.updateCalendarEvent(projectKey, eventId, input),
    onSuccess: () => {
      invalidate();
      toast.success('Event updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteCalendarEvent(projectKey: string) {
  const invalidate = useInvalidateCalendar(projectKey);
  return useMutation({
    mutationFn: ({ eventId, calendarId }: { eventId: string; calendarId: string }) =>
      api.deleteCalendarEvent(projectKey, eventId, calendarId),
    onSuccess: () => {
      invalidate();
      toast.success('Event deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
