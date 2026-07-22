import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type NotificationCursor,
  type NotificationFilters,
  type NotificationDeleteScope,
} from '@/lib/api';
import { qk } from '@/services/queryKeys';

// One project's inbox, keyset-paged and scoped by the active filters. The filters
// object is part of the query key so switching filters is a distinct cache entry.
export function useNotificationsQuery(
  projectKey: string,
  projectId: number,
  filters: NotificationFilters,
) {
  return useInfiniteQuery({
    queryKey: qk.notifications(projectKey, filters),
    queryFn: ({ pageParam }) =>
      api.listNotifications(projectId, { cursor: pageParam, limit: 30, filters }),
    initialPageParam: null as NotificationCursor | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

function useInvalidateInbox(projectKey: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['notifications', projectKey] });
    void qc.invalidateQueries({ queryKey: qk.notificationsUnread(projectKey) });
  };
}

export function useSetNotificationRead(projectKey: string) {
  const invalidate = useInvalidateInbox(projectKey);
  return useMutation({
    mutationFn: ({ id, read }: { id: number; read: boolean }) => api.setNotificationRead(id, read),
    onSuccess: invalidate,
  });
}

export function useMarkAllRead(projectKey: string, projectId: number) {
  const invalidate = useInvalidateInbox(projectKey);
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(projectId),
    onSuccess: invalidate,
  });
}

export function useSnoozeNotification(projectKey: string) {
  const invalidate = useInvalidateInbox(projectKey);
  return useMutation({
    mutationFn: ({ id, until }: { id: number; until: string | null }) =>
      api.snoozeNotification(id, until),
    onSuccess: invalidate,
  });
}

export function useDeleteNotification(projectKey: string) {
  const invalidate = useInvalidateInbox(projectKey);
  return useMutation({
    mutationFn: (id: number) => api.deleteNotification(id),
    onSuccess: invalidate,
  });
}

export function useDeleteNotifications(projectKey: string, projectId: number) {
  const invalidate = useInvalidateInbox(projectKey);
  return useMutation({
    mutationFn: (scope: NotificationDeleteScope) => api.deleteNotifications(scope, projectId),
    onSuccess: invalidate,
  });
}
