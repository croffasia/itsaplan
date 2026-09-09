import { request } from '@/lib/api/core/client';
import type { StateType } from '@/lib/api/endpoints/columns';

// Inbox notifications. Each row is enriched with the issue and project it points at
// so the list renders without extra calls.
export type NotificationType = 'assigned' | 'mentioned' | 'commented' | 'state_changed';

export interface Notification {
  id: number;
  type: NotificationType;
  actorUserId: string | null;
  actorName: string | null;
  readAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  issueId: number;
  issueSeq: number;
  issueTitle: string;
  issueStateType: StateType;
  projectId: number;
  projectKey: string;
  projectName: string;
  // Only a 'state_changed' notification has them.
  fromState: string | null;
  toState: string | null;
}

export interface NotificationCursor {
  ts: string;
  id: number;
}

export interface NotificationPage {
  items: Notification[];
  nextCursor: NotificationCursor | null;
}

export interface NotificationFilters {
  types?: NotificationType[];
  from?: string;
  includeRead?: boolean;
  includeSnoozed?: boolean;
}

export type NotificationDeleteScope = 'all' | 'read' | 'read-completed';

// Inbox notifications. The list is the session user's own; projectId scopes it to
// one project (the per-project inbox). cursor is the JSON-encoded keyset from the
// previous page.
export const listNotifications = (
  projectId: number,
  params: {
    cursor?: NotificationCursor | null;
    limit?: number;
    filters?: NotificationFilters;
  } = {},
) => {
  const q = new URLSearchParams();
  q.set('projectId', String(projectId));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.cursor) q.set('cursor', JSON.stringify(params.cursor));
  const f = params.filters ?? {};
  if (f.types?.length) q.set('types', f.types.join(','));
  if (f.from) q.set('from', f.from);
  if (f.includeRead === false) q.set('includeRead', 'false');
  if (f.includeSnoozed) q.set('includeSnoozed', 'true');
  return request<NotificationPage>(`/notifications?${q.toString()}`);
};

// Unread count for the sidebar badge, refetched when the inbox scope moves.
export const getUnreadCount = (projectId: number) =>
  request<{ unread: number }>(`/notifications/unread?projectId=${projectId}`);

export const setNotificationRead = (id: number, read: boolean) =>
  request<void>(`/notifications/${id}/read`, { method: 'POST', body: JSON.stringify({ read }) });

export const snoozeNotification = (id: number, until: string | null) =>
  request<void>(`/notifications/${id}/snooze`, {
    method: 'POST',
    body: JSON.stringify({ until }),
  });

export const markAllNotificationsRead = (projectId: number) =>
  request<{ count: number }>(`/notifications/read-all`, {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });

export const deleteNotification = (id: number) =>
  request<void>(`/notifications/${id}`, { method: 'DELETE' });

export const deleteNotifications = (scope: NotificationDeleteScope, projectId: number) =>
  request<{ count: number }>(`/notifications?scope=${scope}&projectId=${projectId}`, {
    method: 'DELETE',
  });
