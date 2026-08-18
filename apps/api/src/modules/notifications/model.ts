import { t } from 'elysia';

export const notificationParams = t.Object({ id: t.Numeric() });

const NotificationResponse = t.Object({
  id: t.Number(),
  type: t.String(),
  actorUserId: t.Nullable(t.String()),
  actorName: t.Nullable(t.String()),
  readAt: t.Nullable(t.String()),
  snoozedUntil: t.Nullable(t.String()),
  createdAt: t.String(),
  issueId: t.Number(),
  issueSeq: t.Number(),
  issueTitle: t.String(),
  issueStateType: t.String(),
  projectId: t.Number(),
  projectKey: t.String(),
  projectName: t.String(),
  fromState: t.Nullable(t.String()),
  toState: t.Nullable(t.String()),
});

export const NotificationPageResponse = t.Object({
  items: t.Array(NotificationResponse),
  nextCursor: t.Nullable(t.Object({ ts: t.String(), id: t.Number() })),
});

export const UnreadCountResponse = t.Object({ unread: t.Number() });

// How many rows the bulk read-all and delete routes touched.
export const AffectedCountResponse = t.Object({ count: t.Number() });

export const listNotificationsQuery = t.Object({
  limit: t.Optional(t.String({ description: 'Max items per page (1-100). Default 30.' })),
  cursor: t.Optional(t.String({ description: 'nextCursor from the previous page.' })),
  types: t.Optional(t.String({ description: 'Comma-separated notification types to include.' })),
  from: t.Optional(t.String({ description: 'Filter by actor user id.' })),
  projectId: t.Optional(t.String({ description: 'Filter by project id.' })),
  includeRead: t.Optional(t.String({ description: "'false' hides read. Default true." })),
  includeSnoozed: t.Optional(t.String({ description: "'true' shows snoozed. Default false." })),
});

export const unreadCountQuery = t.Object({
  projectId: t.Optional(t.String({ description: 'Scope the count to one project.' })),
});

export const markAllReadBody = t.Optional(t.Object({ projectId: t.Optional(t.Number()) }));

export const deleteNotificationsQuery = t.Object({
  scope: t.Optional(
    t.Union([t.Literal('all'), t.Literal('read'), t.Literal('read-completed')], {
      description: 'Which notifications to delete. Default read.',
    }),
  ),
  projectId: t.Optional(t.String({ description: 'Scope the delete to one project.' })),
});

export const setNotificationReadBody = t.Optional(t.Object({ read: t.Optional(t.Boolean()) }));

export const snoozeNotificationBody = t.Object({ until: t.Nullable(t.String()) });

export const sendDeliveryBody = t.Object({
  projectId: t.Number(),
  channel: t.UnionEnum(['email', 'telegram']),
  recipient: t.Nullable(t.String()),
  payload: t.Object({
    subject: t.Optional(t.String()),
    text: t.String(),
    // The Telegram body. Elysia strips fields the schema does not declare, so
    // leaving it out here would silently drop the formatted message and send the
    // plain-text fallback instead.
    html: t.Optional(t.String()),
    url: t.Optional(t.String()),
  }),
});
