import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';
import { revScope } from '@/utils/revScopes';
import { useLiveRefresh } from './useLiveRefresh';

// A project's unread notification count, for the sidebar badge and the inbox
// header. Refetched by the inbox scope of the sync provider, so it needs no
// interval of its own. Lives in the shared layer so both the sidebar and the inbox
// feature can use it.
export function useInboxUnread(projectKey: string | null, projectId: number | null) {
  useLiveRefresh({
    scope: projectId != null ? revScope.inbox(projectId) : null,
    targets: [qk.notificationsUnread(projectKey ?? '')],
  });
  return useQuery({
    queryKey: qk.notificationsUnread(projectKey ?? ''),
    queryFn: () => api.getUnreadCount(projectId as number),
    enabled: projectKey != null && projectId != null,
    select: (d) => d.unread,
  });
}
