import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { errors } from '#shared/responses';
import {
  AffectedCountResponse,
  NotificationPageResponse,
  UnreadCountResponse,
  deleteNotificationsQuery,
  listNotificationsQuery,
  markAllReadBody,
  notificationParams,
  setNotificationReadBody,
  snoozeNotificationBody,
  unreadCountQuery,
} from './model';
import {
  listNotifications,
  unreadCount,
  setNotificationRead,
  markAllRead,
  snoozeNotification,
  deleteNotification,
  deleteNotifications,
  NOTIFICATION_TYPES,
  type NotificationType,
  type NotificationFilters,
  type DeleteScope,
} from './service';

// Inbox: the session user's own notifications across every project they are a
// member of. Every route is scoped to that user (no project permission needed to
// read your own inbox); single-notification actions only touch a row that belongs
// to the user.
export const notificationRoutes = new Elysia({
  name: 'notifications',
  detail: { tags: ['Notifications'] },
})
  .use(authContext)

  .get(
    '/notifications',
    async ({ user, query }) => {
      const userId = requireUser(user).id;
      const limit = query.limit != null ? Number(query.limit) : 30;
      let before = null;
      if (query.cursor) {
        try {
          before = JSON.parse(query.cursor);
        } catch {
          // Ignore a malformed cursor and serve the first page.
        }
      }
      const filters: NotificationFilters = {};
      if (query.types) {
        const types = query.types
          .split(',')
          .filter((x): x is NotificationType =>
            (NOTIFICATION_TYPES as readonly string[]).includes(x),
          );
        if (types.length) filters.types = types;
      }
      if (query.from) filters.fromUserId = query.from;
      if (query.projectId) filters.projectId = Number(query.projectId);
      filters.includeRead = query.includeRead !== 'false';
      filters.includeSnoozed = query.includeSnoozed === 'true';
      return listNotifications(userId, { before, limit, filters });
    },
    {
      query: listNotificationsQuery,
      response: { 200: NotificationPageResponse, ...errors(401) },
      detail: { summary: 'List inbox notifications' },
    },
  )

  // The badge count. Refetched when the inbox scope of GET /sync/rev moves.
  .get(
    '/notifications/unread',
    async ({ user, query }) => {
      const userId = requireUser(user).id;
      const projectId = query.projectId ? Number(query.projectId) : undefined;
      return { unread: await unreadCount(userId, projectId) };
    },
    {
      query: unreadCountQuery,
      response: { 200: UnreadCountResponse, ...errors(401) },
      detail: { summary: 'Get unread notification count' },
    },
  )

  .post(
    '/notifications/read-all',
    async ({ user, body }) => {
      const userId = requireUser(user).id;
      const count = await markAllRead(userId, body?.projectId ?? undefined);
      return { count };
    },
    {
      body: markAllReadBody,
      response: { 200: AffectedCountResponse, ...errors(401) },
      detail: { summary: 'Mark all notifications read' },
    },
  )

  .delete(
    '/notifications',
    async ({ user, query }) => {
      const userId = requireUser(user).id;
      const scope = (query.scope ?? 'read') as DeleteScope;
      const projectId = query.projectId ? Number(query.projectId) : undefined;
      const count = await deleteNotifications(userId, scope, projectId);
      return { count };
    },
    {
      query: deleteNotificationsQuery,
      response: { 200: AffectedCountResponse, ...errors(401) },
      detail: { summary: 'Delete inbox notifications' },
    },
  )

  .post(
    '/notifications/:id/read',
    async ({ user, params, body }) => {
      const userId = requireUser(user).id;
      const read = body?.read ?? true;
      const ok = await setNotificationRead(userId, params.id, read);
      if (!ok) throw new HttpError(404, 'Notification not found');
      return noContent();
    },
    {
      params: notificationParams,
      body: setNotificationReadBody,
      response: { 204: t.Void(), ...errors(401, 404) },
      detail: { summary: 'Mark a notification read or unread' },
    },
  )

  .post(
    '/notifications/:id/snooze',
    async ({ user, params, body }) => {
      const userId = requireUser(user).id;
      const until = body.until ? new Date(body.until) : null;
      if (until && Number.isNaN(until.getTime())) throw new HttpError(400, 'Invalid snooze time');
      const ok = await snoozeNotification(userId, params.id, until);
      if (!ok) throw new HttpError(404, 'Notification not found');
      return noContent();
    },
    {
      params: notificationParams,
      body: snoozeNotificationBody,
      response: { 204: t.Void(), ...errors(400, 401, 404) },
      detail: {
        summary: 'Snooze a notification',
        description: 'Snooze a notification until a time, or clear its snooze.',
      },
    },
  )

  .delete(
    '/notifications/:id',
    async ({ user, params }) => {
      const userId = requireUser(user).id;
      const ok = await deleteNotification(userId, params.id);
      if (!ok) throw new HttpError(404, 'Notification not found');
      return noContent();
    },
    {
      params: notificationParams,
      response: { 204: t.Void(), ...errors(401, 404) },
      detail: { summary: 'Delete a notification' },
    },
  );
