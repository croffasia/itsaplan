import { useQuery } from '@tanstack/react-query';
import { getUnreadCount } from '@/lib/api/endpoints/notifications';
import { qk } from '@/services/queryKeys';
import { useInboxLiveRefresh } from './useInboxLiveRefresh';

// A project's unread notification count, for the sidebar badge and the inbox
// header. Refetched by the inbox scope of the sync provider, so it needs no
// interval of its own. Lives in the shared layer so both the sidebar and the inbox
// feature can use it.
export function useInboxUnread(projectKey: string | null, projectId: number | null) {
  useInboxLiveRefresh(projectId, [qk.notificationsUnread(projectKey ?? '')], projectKey != null);
  return useQuery({
    queryKey: qk.notificationsUnread(projectKey ?? ''),
    queryFn: () => getUnreadCount(projectId),
    enabled: projectKey != null,
    select: (d) => d.unread,
  });
}
