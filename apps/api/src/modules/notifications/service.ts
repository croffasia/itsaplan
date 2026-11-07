import {
  db,
  notification,
  projectMember,
  user,
  issue,
  issueActivity,
  project,
  projectColumn,
  projectDocument,
  type ActivityPayload,
} from '@repo/db';
import { and, desc, eq, inArray, isNotNull, lt, or, sql, isNull } from 'drizzle-orm';
import { addedMentionHandles, resolveMentionHandles, type MentionedUsers } from '#shared/mentions';
import { autoWatchIssue, watcherUserIds } from '#modules/issues/watchers';
import { mentionReach } from '#modules/mentions/service';
import { iso } from '#shared/lib';
import { enqueueOutbound } from './outbound';

// Inbox notifications. A notification is one (recipient, event) row: a user is told
// about an issue they are involved in, or that a document mentions them. What happens
// on the issue ('commented', 'state_changed') goes to its watchers (issue_watcher, see
// modules/issues/watchers.ts); what is addressed to one person ('assigned',
// 'mentioned') goes to them whether they watch the issue or not, and subscribes them
// to it. A document has no watchers, so it only sends 'mentioned'. The actor is never
// notified about their own action, and only project members receive notifications,
// so agent bot users (assigned via delegate, not members) are excluded.

export const NOTIFICATION_TYPES = ['assigned', 'mentioned', 'commented', 'state_changed'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Points at an issue, or at a document: then documentId is set and issueId is null.
export interface NewNotificationRow {
  userId: string;
  projectId: number;
  issueId: number | null;
  sourceActivityId: number | null;
  documentId?: number;
  documentCommentId?: string | null;
  type: NotificationType;
  actorUserId: string | null;
}

// Keeps only the ids that are members of the project. Filters out non-members (an
// agent's bot user is assigned via delegate but is not a member) and users who have
// lost access.
async function keepProjectMembers(projectId: number, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ userId: projectMember.userId })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), inArray(projectMember.userId, ids)));
  return new Set(rows.map((r) => r.userId));
}

async function actorName(id: string | null): Promise<string | null> {
  if (id == null) return null;
  const rows = await db.select({ name: user.name }).from(user).where(eq(user.id, id));
  return rows[0]?.name ?? null;
}

// commentId names the comment the event is about, which its email and Telegram link to.
async function insertNotifications(
  rows: NewNotificationRow[],
  commentId: number | null = null,
): Promise<void> {
  if (rows.length === 0) return;
  const name = await actorName(rows[0].actorUserId);
  await db.insert(notification).values(rows.map((r) => ({ ...r, actorName: name })));
  // Fan out to the project's enabled delivery channels (email, Telegram). Best-effort:
  // a delivery failure must not break the inbox insert or the domain mutation.
  try {
    await enqueueOutbound(rows, name, commentId);
  } catch (err) {
    console.error('[notifications] outbound enqueue failed:', err);
  }
}

// Fan out a new comment. Mentioned members get a 'mentioned' notification; the
// watchers get 'commented'. A mentioned user gets only the 'mentioned' one. The
// comment author is never notified. Commenting and being mentioned both subscribe
// to the issue, so the watchers are resolved after that.
export async function notifyComment(
  projectId: number,
  comment: { issueId: number; id: number; actorUserId: string | null; body: string | null },
  mentionedUsers: MentionedUsers,
): Promise<void> {
  const actor = comment.actorUserId;
  const mentioned = new Set([...mentionedUsers.memberIds, ...mentionedUsers.agentUserIds]);
  await autoWatchIssue(projectId, comment.issueId, [actor, ...mentioned]);
  const watchers = await watcherUserIds(projectId, comment.issueId);

  const rows: NewNotificationRow[] = [];
  for (const userId of mentioned) {
    if (userId === actor) continue;
    rows.push({
      userId,
      projectId,
      issueId: comment.issueId,
      sourceActivityId: comment.id,
      type: 'mentioned',
      actorUserId: actor,
    });
  }
  for (const userId of watchers) {
    if (userId === actor || mentioned.has(userId)) continue;
    rows.push({
      userId,
      projectId,
      issueId: comment.issueId,
      sourceActivityId: comment.id,
      type: 'commented',
      actorUserId: actor,
    });
  }
  await insertNotifications(rows, comment.id);
}

// Fan out the mentions an edit newly added to a comment. The handles the comment
// already named are filtered out by the caller, so an edit never re-pings them, and
// the watchers hear nothing (unlike a new comment, which would send 'commented').
// Being mentioned subscribes to the issue, the same as in a new comment.
export async function notifyEditedCommentMentions(
  projectId: number,
  comment: { issueId: number; id: number; actorUserId: string | null },
  mentionedUsers: MentionedUsers,
): Promise<void> {
  const mentioned = [...mentionedUsers.memberIds, ...mentionedUsers.agentUserIds].filter(
    (userId) => userId !== comment.actorUserId,
  );
  if (mentioned.length === 0) return;
  await autoWatchIssue(projectId, comment.issueId, mentioned);
  await insertNotifications(
    mentioned.map((userId) => ({
      userId,
      projectId,
      issueId: comment.issueId,
      sourceActivityId: comment.id,
      type: 'mentioned' as const,
      actorUserId: comment.actorUserId,
    })),
    comment.id,
  );
}

// Fan out the mentions an issue's description or markdown custom field gained. Only
// the handles the write added are reached, so re-saving a text keeps quiet about the
// people it already named. Being mentioned subscribes to the issue, the same as it
// does in a comment. A text reaches only the members it names (see mentionReach): an
// agent is addressed in a comment, or given an issue by delegation.
export async function notifyTextMentions(input: {
  projectId: number;
  issueId: number;
  actorUserId: string | null;
  // The change-log entry the write recorded, so the inbox item links to it.
  sourceActivityId: number | null;
  before: string;
  after: string;
}): Promise<void> {
  const { projectId, issueId, actorUserId: actor } = input;
  const handles = addedMentionHandles(input.before, input.after);
  if (handles.length === 0) return;
  const { memberIds } = await mentionReach(
    projectId,
    actor,
    { on: 'issue', place: 'text' },
    await resolveMentionHandles(projectId, handles),
  );
  if (memberIds.length === 0) return;
  await autoWatchIssue(projectId, issueId, memberIds);
  await insertNotifications(
    memberIds
      .filter((userId) => userId !== actor)
      .map((userId) => ({
        userId,
        projectId,
        issueId,
        sourceActivityId: input.sourceActivityId,
        type: 'mentioned' as const,
        actorUserId: actor,
      })),
  );
}

// Fan out issue field changes recorded by an update. A new assignee (if a member and
// not the actor) gets 'assigned'; a status change notifies the issue's watchers with
// 'state_changed'. The actor is never notified. Being assigned subscribes to the
// issue, and stays that way when the issue is later handed to someone else.
export async function notifyIssueChange(input: {
  projectId: number;
  issueId: number;
  actorUserId: string | null;
  assignedUserId?: string | null;
  assignedActivityId?: number | null;
  statusChanged?: boolean;
  statusActivityId?: number | null;
}): Promise<void> {
  const { projectId, issueId, actorUserId: actor } = input;
  const rows: NewNotificationRow[] = [];

  if (input.assignedUserId) {
    await autoWatchIssue(projectId, issueId, [input.assignedUserId]);
    if (input.assignedUserId !== actor) {
      const members = await keepProjectMembers(projectId, [input.assignedUserId]);
      if (members.has(input.assignedUserId)) {
        rows.push({
          userId: input.assignedUserId,
          projectId,
          issueId,
          sourceActivityId: input.assignedActivityId ?? null,
          type: 'assigned',
          actorUserId: actor,
        });
      }
    }
  }

  if (input.statusChanged) {
    const assigned = input.assignedUserId ?? null;
    const watchers = await watcherUserIds(projectId, issueId);
    for (const userId of watchers) {
      // Skip the actor and anyone already told they were just assigned.
      if (userId === actor || userId === assigned) continue;
      rows.push({
        userId,
        projectId,
        issueId,
        sourceActivityId: input.statusActivityId ?? null,
        type: 'state_changed',
        actorUserId: actor,
      });
    }
  }

  await insertNotifications(rows);
}

// Fan out a mention in a document: in its text, or in the comment documentCommentId
// names. The caller resolves who may read the document; the actor is left out here.
export async function notifyDocumentMentions(input: {
  projectId: number;
  documentId: number;
  documentCommentId: string | null;
  actorUserId: string | null;
  memberIds: string[];
}): Promise<void> {
  await insertNotifications(
    input.memberIds
      .filter((userId) => userId !== input.actorUserId)
      .map((userId) => ({
        userId,
        projectId: input.projectId,
        issueId: null,
        sourceActivityId: null,
        documentId: input.documentId,
        documentCommentId: input.documentCommentId,
        type: 'mentioned' as const,
        actorUserId: input.actorUserId,
      })),
  );
}

// --- Inbox read + mutations ------------------------------------------------------

// A notification enriched with the issue or the document and the project it points at,
// so the inbox can render a row (identifier or title, project, actor, status) without
// extra calls. The issue fields are null on a document's notification, the document
// fields on an issue's.
export interface NotificationRow {
  id: number;
  type: NotificationType;
  actorUserId: string | null;
  actorName: string | null;
  readAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  issueId: number | null;
  issueSeq: number | null;
  issueTitle: string | null;
  issueStateType: string | null;
  // Set while the issue comment it is about still exists.
  issueCommentId: number | null;
  documentId: number | null;
  documentTitle: string | null;
  documentIcon: string | null;
  // Set when the mention is in a comment on the document.
  documentCommentId: string | null;
  projectId: number;
  projectKey: string;
  projectName: string;
  // Only a 'state_changed' event has them, and only while its activity row lives.
  fromState: string | null;
  toState: string | null;
}

export interface NotificationCursor {
  ts: string;
  id: number;
}

export interface NotificationPage {
  items: NotificationRow[];
  nextCursor: NotificationCursor | null;
}

export interface NotificationFilters {
  types?: NotificationType[];
  fromUserId?: string;
  projectId?: number;
  includeRead?: boolean;
  includeSnoozed?: boolean;
}

function notificationConditions(userId: string, f: NotificationFilters) {
  const conds = [eq(notification.userId, userId)];
  if (f.types && f.types.length) conds.push(inArray(notification.type, f.types));
  if (f.fromUserId) conds.push(eq(notification.actorUserId, f.fromUserId));
  if (f.projectId != null) conds.push(eq(notification.projectId, f.projectId));
  if (f.includeRead === false) conds.push(isNull(notification.readAt));
  if (!f.includeSnoozed)
    conds.push(or(isNull(notification.snoozedUntil), lt(notification.snoozedUntil, sql`now()`))!);
  return conds;
}

function mapRow(r: {
  id: number;
  type: string;
  actorUserId: string | null;
  actorName: string | null;
  readAt: Date | null;
  snoozedUntil: Date | null;
  createdAt: Date;
  issueId: number | null;
  issueSeq: number | null;
  issueTitle: string | null;
  issueStateType: string | null;
  activityId: number | null;
  activityKind: string | null;
  documentId: number | null;
  documentTitle: string | null;
  documentIcon: string | null;
  documentCommentId: string | null;
  projectId: number;
  projectKey: string;
  projectName: string;
  payload: ActivityPayload | null;
}): NotificationRow {
  const stateChange = r.type === 'state_changed';
  return {
    id: r.id,
    type: r.type as NotificationType,
    actorUserId: r.actorUserId,
    actorName: r.actorName,
    readAt: r.readAt ? iso(r.readAt) : null,
    snoozedUntil: r.snoozedUntil ? iso(r.snoozedUntil) : null,
    createdAt: iso(r.createdAt),
    issueId: r.issueId,
    issueSeq: r.issueSeq,
    issueTitle: r.issueTitle,
    issueStateType: r.issueStateType,
    issueCommentId: r.activityKind === 'comment' ? r.activityId : null,
    documentId: r.documentId,
    documentTitle: r.documentTitle,
    documentIcon: r.documentIcon,
    documentCommentId: r.documentCommentId,
    projectId: r.projectId,
    projectKey: r.projectKey,
    projectName: r.projectName,
    fromState: stateChange ? (r.payload?.from?.value ?? null) : null,
    toState: stateChange ? (r.payload?.to?.value ?? null) : null,
  };
}

// The document of a notification, joined only while the user may still open it: a page
// made private after it mentioned someone is its owner's alone.
function visibleDocument(userId: string) {
  return and(
    eq(projectDocument.id, notification.documentId),
    or(eq(projectDocument.isPrivate, false), eq(projectDocument.ownerUserId, userId)),
  );
}

// A notification whose issue or document the user can still see.
const hasTarget = or(isNotNull(notification.issueId), isNotNull(projectDocument.id));

// One page of a user's inbox, newest first, keyset-paged on (created_at, id).
// Only projects the user is still a member of: the row carries the issue title, its
// current state, the document title and the project name read at query time, so a
// removed member must not reach them. includeRead defaults to true (the inbox shows
// read notifications too); a snoozed notification (snoozed_until still in the future)
// is hidden unless includeSnoozed. limit is clamped to 1..100.
export async function listNotifications(
  userId: string,
  opts: { before?: NotificationCursor | null; limit?: number; filters?: NotificationFilters } = {},
): Promise<NotificationPage> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const before = opts.before ?? null;
  const f = opts.filters ?? {};
  const conds = notificationConditions(userId, f);
  if (before)
    conds.push(
      sql`(${notification.createdAt}, ${notification.id}) < (${before.ts}::timestamptz, ${before.id}::integer)`,
    );

  const rows = await db
    .select({
      id: notification.id,
      type: notification.type,
      actorUserId: notification.actorUserId,
      actorName: notification.actorName,
      readAt: notification.readAt,
      snoozedUntil: notification.snoozedUntil,
      createdAt: notification.createdAt,
      cursorTs: sql<string>`${notification.createdAt}::text`,
      issueId: notification.issueId,
      issueSeq: issue.sequenceNumber,
      issueTitle: issue.title,
      issueStateType: projectColumn.stateType,
      activityId: issueActivity.id,
      activityKind: issueActivity.kind,
      documentId: projectDocument.id,
      documentTitle: projectDocument.title,
      documentIcon: projectDocument.icon,
      documentCommentId: notification.documentCommentId,
      projectId: project.id,
      projectKey: project.key,
      projectName: project.name,
      payload: issueActivity.payload,
    })
    .from(notification)
    .innerJoin(
      projectMember,
      and(eq(projectMember.projectId, notification.projectId), eq(projectMember.userId, userId)),
    )
    .innerJoin(project, eq(project.id, notification.projectId))
    .leftJoin(issue, eq(issue.id, notification.issueId))
    .leftJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .leftJoin(projectDocument, visibleDocument(userId))
    .leftJoin(issueActivity, eq(issueActivity.id, notification.sourceActivityId))
    .where(and(...conds, hasTarget))
    .orderBy(desc(notification.createdAt), desc(notification.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map(mapRow),
    nextCursor: hasMore && last ? { ts: last.cursorTs, id: last.id } : null,
  };
}

// The number of unread, non-snoozed notifications for the inbox badge, optionally
// scoped to one project. Counts only what listNotifications shows.
export async function unreadCount(userId: string, projectId?: number): Promise<number> {
  const conds = [
    eq(notification.userId, userId),
    isNull(notification.readAt),
    or(isNull(notification.snoozedUntil), lt(notification.snoozedUntil, sql`now()`)),
  ];
  if (projectId != null) conds.push(eq(notification.projectId, projectId));
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notification)
    .innerJoin(
      projectMember,
      and(eq(projectMember.projectId, notification.projectId), eq(projectMember.userId, userId)),
    )
    .leftJoin(projectDocument, visibleDocument(userId))
    .where(and(...conds, hasTarget));
  return row?.n ?? 0;
}

// Marks one of the user's notifications read or unread. Returns false if no such
// notification belongs to the user.
export async function setNotificationRead(
  userId: string,
  id: number,
  read: boolean,
): Promise<boolean> {
  const rows = await db
    .update(notification)
    .set({ readAt: read ? sql`now()` : null })
    .where(and(eq(notification.id, id), eq(notification.userId, userId)))
    .returning({ id: notification.id });
  return rows.length > 0;
}

// Marks the user's matching unread notifications read.
// Returns how many were updated.
export async function markAllRead(
  userId: string,
  projectId?: number,
  filters: NotificationFilters = { includeSnoozed: true },
): Promise<number> {
  const conds = notificationConditions(userId, { ...filters, projectId });
  conds.push(isNull(notification.readAt));
  const rows = await db
    .update(notification)
    .set({ readAt: sql`now()` })
    .where(and(...conds))
    .returning({ id: notification.id });
  return rows.length;
}

// Snoozes one of the user's notifications until the given time (null clears it).
// Returns false if no such notification belongs to the user.
export async function snoozeNotification(
  userId: string,
  id: number,
  until: Date | null,
): Promise<boolean> {
  const rows = await db
    .update(notification)
    .set({ snoozedUntil: until })
    .where(and(eq(notification.id, id), eq(notification.userId, userId)))
    .returning({ id: notification.id });
  return rows.length > 0;
}

// Deletes one of the user's notifications. Returns false if it did not belong to
// the user.
export async function deleteNotification(userId: string, id: number): Promise<boolean> {
  const rows = await db
    .delete(notification)
    .where(and(eq(notification.id, id), eq(notification.userId, userId)))
    .returning({ id: notification.id });
  return rows.length > 0;
}

export type DeleteScope = 'all' | 'read' | 'read-completed' | 'completed';

// Bulk-deletes matching notifications: all, read, read on completed/canceled issues,
// or all on completed/canceled issues. Returns how many were deleted.
export async function deleteNotifications(
  userId: string,
  scope: DeleteScope,
  projectId?: number,
  filters: NotificationFilters = { includeSnoozed: true },
): Promise<number> {
  // Completed deletes read and unread by design, so the inbox's show-read
  // toggle must not narrow it.
  const bulkFilters = scope === 'completed' ? { ...filters, includeRead: true } : filters;
  const conds = notificationConditions(userId, { ...bulkFilters, projectId });
  if (scope === 'read' || scope === 'read-completed')
    conds.push(sql`${notification.readAt} is not null`);
  if (scope === 'read-completed' || scope === 'completed') {
    const completedIssues = db
      .select({ id: issue.id })
      .from(issue)
      .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
      .where(inArray(projectColumn.stateType, ['completed', 'canceled']));
    conds.push(inArray(notification.issueId, completedIssues));
  }
  const rows = await db
    .delete(notification)
    .where(and(...conds))
    .returning({ id: notification.id });
  return rows.length;
}
