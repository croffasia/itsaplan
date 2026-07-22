import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// A project's unread notification count, for the sidebar badge and the inbox
// header. Polls the cheap rev marker; React Query pauses the interval while the tab
// is in the background. Lives in the shared layer so both the sidebar and the inbox
// feature can use it.
export function useInboxUnread(projectKey: string | null, projectId: number | null) {
  return useQuery({
    queryKey: qk.notificationsUnread(projectKey ?? ''),
    queryFn: () => api.getNotificationsRev(projectId as number),
    enabled: projectKey != null && projectId != null,
    refetchInterval: 15000,
    select: (d) => d.unread,
  });
}
