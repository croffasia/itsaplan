import {
  db,
  notification,
  issueActivity,
  projectMember,
  user,
  issue,
  project,
  projectColumn,
} from '@repo/db';
import { and, desc, eq, inArray, lt, or, sql, isNull } from 'drizzle-orm';
import { parseMentions } from '../ai-agents/mentions';
import { iso } from '../shared/lib';
import { enqueueOutbound } from './outbound';

// Inbox notifications. A notification is one (recipient, event) row: a user is told
// about an issue they are involved in. Recipients are derived from issue_activity
// (assignee, delegate, and anyone who has acted on the issue) rather than a separate
// subscription table. The actor is never notified about their own action, and only
// project members receive notifications, so agent bot users (assigned via delegate,
// not members) are excluded.

export type NotificationType = 'assigned' | 'mentioned' | 'commented' | 'state_changed';

export interface NewNotificationRow {
  userId: string;
  projectId: number;
  issueId: number;
  sourceActivityId: number | null;
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

// The members who should hear about activity on an issue: its assignee and delegate,
// plus anyone who has previously acted on it (a comment or a logged change). Bot
// users and non-members are dropped by keepProjectMembers.
async function issueParticipants(projectId: number, issueId: number): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ actorUserId: issueActivity.actorUserId })
    .from(issueActivity)
    .where(and(eq(issueActivity.issueId, issueId), sql`${issueActivity.actorUserId} IS NOT NULL`));
  const candidates = rows.map((r) => r.actorUserId as string);
  return keepProjectMembers(projectId, candidates);
}

async function actorName(id: string | null): Promise<string | null> {
  if (id == null) return null;
  const rows = await db.select({ name: user.name }).from(user).where(eq(user.id, id));
  return rows[0]?.name ?? null;
}

async function insertNotifications(rows: NewNotificationRow[]): Promise<void> {
  if (rows.length === 0) return;
  const name = await actorName(rows[0].actorUserId);
  await db.insert(notification).values(rows.map((r) => ({ ...r, actorName: name })));
  // Fan out to the project's enabled delivery channels (email, Telegram). Best-effort:
  // a delivery failure must not break the inbox insert or the domain mutation.
  try {
    await enqueueOutbound(rows, name);
  } catch (err) {
    console.error('[notifications] outbound enqueue failed:', err);
  }
}

// Fan out a new comment. Mentioned members get a 'mentioned' notification; the other
// participants get 'commented'. A mentioned user gets only the 'mentioned' one. The
// comment author is never notified.
export async function notifyComment(
  projectId: number,
  comment: { issueId: number; id: number; actorUserId: string | null; body: string | null },
): Promise<void> {
  const actor = comment.actorUserId;
  const mentionedIds = parseMentions(comment.body ?? '');
  const mentioned = await keepProjectMembers(projectId, mentionedIds);
  const participants = await issueParticipants(projectId, comment.issueId);

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
  for (const userId of participants) {
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
  await insertNotifications(rows);
}

// Fan out issue field changes recorded by an update. A new assignee (if a member and
// not the actor) gets 'assigned'; a status change notifies the issue's participants
// with 'state_changed'. The actor is never notified.
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

  if (input.assignedUserId && input.assignedUserId !== actor) {
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

  if (input.statusChanged) {
    const assigned = input.assignedUserId ?? null;
    const participants = await issueParticipants(projectId, issueId);
    for (const userId of participants) {
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

// --- Inbox read + mutations ------------------------------------------------------

// A notification enriched with the issue and project it points at, so the inbox can
// render a row (identifier, title, project, actor, status) without extra calls.
export interface NotificationRow {
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
  issueStateType: string;
  projectId: number;
  projectKey: string;
  projectName: string;
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

function mapRow(r: {
  id: number;
  type: string;
  actorUserId: string | null;
  actorName: string | null;
  readAt: Date | null;
  snoozedUntil: Date | null;
  createdAt: Date;
  issueId: number;
  issueSeq: number;
  issueTitle: string;
  issueStateType: string;
  projectId: number;
  projectKey: string;
  projectName: string;
}): NotificationRow {
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
    projectId: r.projectId,
    projectKey: r.projectKey,
    projectName: r.projectName,
  };
}

// One page of a user's inbox, newest first, keyset-paged on (created_at, id).
// includeRead defaults to true (the inbox shows read notifications too); a snoozed
// notification (snoozed_until still in the future) is hidden unless includeSnoozed.
// limit is clamped to 1..100.
export async function listNotifications(
  userId: string,
  opts: { before?: NotificationCursor | null; limit?: number; filters?: NotificationFilters } = {},
): Promise<NotificationPage> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const before = opts.before ?? null;
  const f = opts.filters ?? {};
  const conds = [eq(notification.userId, userId)];
  if (f.types && f.types.length) conds.push(inArray(notification.type, f.types));
  if (f.fromUserId) conds.push(eq(notification.actorUserId, f.fromUserId));
  if (f.projectId != null) conds.push(eq(notification.projectId, f.projectId));
  if (f.includeRead === false) conds.push(isNull(notification.readAt));
  if (!f.includeSnoozed)
    conds.push(or(isNull(notification.snoozedUntil), lt(notification.snoozedUntil, sql`now()`))!);
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
      issueId: issue.id,
      issueSeq: issue.sequenceNumber,
      issueTitle: issue.title,
      issueStateType: projectColumn.stateType,
      projectId: project.id,
      projectKey: project.key,
      projectName: project.name,
    })
    .from(notification)
    .innerJoin(issue, eq(issue.id, notification.issueId))
    .innerJoin(project, eq(project.id, notification.projectId))
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(and(...conds))
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
// scoped to one project.
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
    .where(and(...conds));
  return row?.n ?? 0;
}

// Cheap change marker for live refresh: total count, max id, and unread count,
// optionally scoped to one project. It moves on a new notification (max id), a
// delete (total), and a read/unread toggle (unread).
export async function notificationsRev(userId: string, projectId?: number): Promise<string> {
  const conds = [eq(notification.userId, userId)];
  if (projectId != null) conds.push(eq(notification.projectId, projectId));
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      maxId: sql<number>`coalesce(max(${notification.id}), 0)::int`,
      unread: sql<number>`count(*) filter (where ${notification.readAt} is null)::int`,
    })
    .from(notification)
    .where(and(...conds));
  return `${row?.total ?? 0}:${row?.maxId ?? 0}:${row?.unread ?? 0}`;
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

// Marks every unread notification of the user read, optionally scoped to a project.
// Returns how many were updated.
export async function markAllRead(userId: string, projectId?: number): Promise<number> {
  const conds = [eq(notification.userId, userId), isNull(notification.readAt)];
  if (projectId != null) conds.push(eq(notification.projectId, projectId));
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

export type DeleteScope = 'all' | 'read' | 'read-completed';

// Bulk-deletes the user's notifications by scope: all, all read, or all read whose
// issue is in a completed or canceled column. Scoped to one project when projectId
// is given (the per-project inbox). Returns how many were deleted.
export async function deleteNotifications(
  userId: string,
  scope: DeleteScope,
  projectId?: number,
): Promise<number> {
  const conds = [eq(notification.userId, userId)];
  if (projectId != null) conds.push(eq(notification.projectId, projectId));
  if (scope === 'read' || scope === 'read-completed')
    conds.push(sql`${notification.readAt} is not null`);
  if (scope === 'read-completed') {
    // read notifications whose issue sits in a completed/canceled column.
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
