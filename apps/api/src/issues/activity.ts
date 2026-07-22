import {
  db,
  issue,
  issueActivity,
  user,
  projectColumn,
  issueType,
  label,
  initiative,
} from '@repo/db';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { iso } from '../shared/lib';
import { emitWebhookEvent } from '../webhooks/emit';
import { parseMentions } from '../ai-agents/mentions';
import { isAgentUser, listInternalAgentsByUserIds } from '../ai-agents/store';
import { enqueueAgentRun } from '../ai-agents/run-queue';
import { notifyComment, notifyIssueChange } from '../notifications/store';

// Issue timeline: comments and change-log activity in one table (issue_activity).
// kind selects which payload columns a row uses. The author is the session user
// (a member or an agent's bot user); actor_name is a snapshot taken at write time,
// so an entry keeps reading correctly after that user is renamed or deleted. The
// issue detail panel renders the feed newest first and pages through it with a
// (created_at, id) keyset cursor.

export type FeedKind = 'comment' | 'activity';

export interface FeedItemRow {
  id: number;
  issueId: number;
  kind: FeedKind;
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: string | null;
  subject: string | null;
  fromText: string | null;
  toText: string | null;
  createdAt: string;
}

// Opaque page cursor: the (created_at, id) of the last returned item. id breaks
// ties when two entries share a created_at (bulk activity from one edit).
export interface FeedCursor {
  ts: string;
  id: number;
}

export interface FeedPage {
  items: FeedItemRow[];
  nextCursor: FeedCursor | null;
}

function mapFeedItem(row: {
  id: number;
  // Nullable at the column level (initiative rows share this table), but the
  // issue feed and createComment only ever handle issue rows, so it is present.
  issueId: number | null;
  kind: string;
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: string | null;
  subject: string | null;
  fromText: string | null;
  toText: string | null;
  createdAt: Date;
}): FeedItemRow {
  return {
    id: row.id,
    issueId: row.issueId as number,
    kind: row.kind as FeedKind,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    body: row.body,
    action: row.action,
    subject: row.subject,
    fromText: row.fromText,
    toText: row.toText,
    createdAt: iso(row.createdAt),
  };
}

// One page of an issue's feed, newest first. cursor_ts is created_at as full-
// precision text so the returned nextCursor round-trips without the millisecond
// truncation iso() would apply. limit is clamped to 1..100.
export async function listFeed(
  issueId: number,
  opts: { before?: FeedCursor | null; limit?: number } = {},
): Promise<FeedPage> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const before = opts.before ?? null;
  const rows = await db
    .select({
      id: issueActivity.id,
      issueId: issueActivity.issueId,
      kind: issueActivity.kind,
      actorUserId: issueActivity.actorUserId,
      actorName: issueActivity.actorName,
      body: issueActivity.body,
      action: issueActivity.action,
      subject: issueActivity.subject,
      fromText: issueActivity.fromText,
      toText: issueActivity.toText,
      createdAt: issueActivity.createdAt,
      cursorTs: sql<string>`${issueActivity.createdAt}::text`,
    })
    .from(issueActivity)
    .where(
      and(
        eq(issueActivity.issueId, issueId),
        before
          ? sql`(${issueActivity.createdAt}, ${issueActivity.id}) < (${before.ts}::timestamptz, ${before.id}::integer)`
          : undefined,
      ),
    )
    .orderBy(desc(issueActivity.createdAt), desc(issueActivity.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map(mapFeedItem),
    nextCursor: hasMore && last ? { ts: last.cursorTs, id: last.id } : null,
  };
}

export async function createComment(input: {
  issueId: number;
  actorUserId?: string | null;
  body: string;
}): Promise<FeedItemRow> {
  const actorUserId = input.actorUserId ?? null;
  const actorName = await userName(actorUserId);
  const [row] = await db
    .insert(issueActivity)
    .values({ issueId: input.issueId, kind: 'comment', actorUserId, actorName, body: input.body })
    .returning();
  const comment = mapFeedItem(row);

  const projectRows = await db
    .select({ projectId: issue.projectId })
    .from(issue)
    .where(eq(issue.id, input.issueId));
  const projectId = projectRows[0]?.projectId;
  if (projectId != null) {
    await emitWebhookEvent(projectId, 'comment.created', comment);
    await enqueueMentionRuns(projectId, comment);
    await notifyComment(projectId, comment);
  }

  return comment;
}

// If the comment mentions internal agents, queue a run for each so they can reply.
// Only quick queries run here; the LLM call happens later in the poller, so creating
// a comment is never blocked on it. Comments authored by an agent's bot user never
// trigger runs, which stops agents from setting each other (or themselves) off.
async function enqueueMentionRuns(projectId: number, comment: FeedItemRow): Promise<void> {
  const mentionedUserIds = parseMentions(comment.body ?? '');
  if (mentionedUserIds.length === 0) return;
  if (comment.actorUserId && (await isAgentUser(comment.actorUserId))) return;
  const agents = await listInternalAgentsByUserIds(projectId, mentionedUserIds);
  for (const agent of agents) {
    await enqueueAgentRun({
      agentId: agent.id,
      issueId: comment.issueId,
      sourceActivityId: comment.id,
      prompt: comment.body ?? '',
    });
  }
}

// --- Activity log ----------------------------------------------------------------
// recordActivity writes change-log entries into the shared feed (kind 'activity');
// the issue mutation functions call it. The issue detail panel renders these
// together with comments as one timeline.

export interface ActivityInput {
  action: string;
  subject?: string | null;
  fromText?: string | null;
  toText?: string | null;
}

// Records the given events for an issue. actorUserId is the session user behind
// the write (a member or an agent's bot user); it is null for a system write with
// no user. actor_name is snapshotted from that user so the entry survives the user
// being renamed or deleted.
export async function recordActivity(
  issueId: number,
  events: ActivityInput[],
  actorUserId?: string | null,
): Promise<{ id: number; action: string | null }[]> {
  if (!events.length) return [];
  const resolvedActorId = actorUserId ?? null;
  const actorName = await userName(resolvedActorId);
  return db
    .insert(issueActivity)
    .values(
      events.map((e) => ({
        issueId,
        kind: 'activity' as const,
        actorUserId: resolvedActorId,
        actorName,
        action: e.action,
        subject: e.subject ?? null,
        fromText: e.fromText ?? null,
        toText: e.toText ?? null,
      })),
    )
    .returning({ id: issueActivity.id, action: issueActivity.action });
}

// Name snapshots for the referenced rows, resolved at change time so a log entry
// keeps reading correctly after the column/type/user/label is renamed or deleted.
async function columnName(id: number | null): Promise<string | null> {
  if (id == null) return null;
  const rows = await db
    .select({ name: projectColumn.name })
    .from(projectColumn)
    .where(eq(projectColumn.id, id));
  return rows[0]?.name ?? null;
}
async function typeName(id: number | null): Promise<string | null> {
  if (id == null) return null;
  const rows = await db
    .select({ name: issueType.name })
    .from(issueType)
    .where(eq(issueType.id, id));
  return rows[0]?.name ?? null;
}
async function initiativeName(id: number | null): Promise<string | null> {
  if (id == null) return null;
  const rows = await db
    .select({ title: initiative.title })
    .from(initiative)
    .where(eq(initiative.id, id));
  return rows[0]?.title ?? null;
}
async function userName(id: string | null): Promise<string | null> {
  if (id == null) return null;
  const rows = await db.select({ name: user.name }).from(user).where(eq(user.id, id));
  return rows[0]?.name ?? null;
}
// Name snapshots for a set of labels in one query, resolved at change time so a
// log entry keeps reading correctly after a label is renamed or deleted. Ids with
// no matching label are absent from the map.
export async function labelNames(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (ids.length === 0) return out;
  const rows = await db
    .select({ id: label.id, name: label.name })
    .from(label)
    .where(inArray(label.id, ids));
  for (const r of rows) out.set(r.id, r.name);
  return out;
}

// The subset of an issue's fields the change log diffs.
export interface IssueSnapshot {
  id: number;
  title: string;
  description: string;
  columnId: number;
  typeId: number | null;
  initiativeId: number | null;
  assigneeUserId: string | null;
  delegateUserId: string | null;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
}

// Diffs an issue's before/after state and records one event per changed field.
// Priority and dates are stored as their raw value (the UI maps priority to a
// label and formats dates); description stores only the new value (it is long,
// shown in a popover in the feed). Position is intentionally not logged —
// reordering within a column is not a meaningful change.
export async function logIssueUpdate(
  before: IssueSnapshot,
  after: IssueSnapshot,
  actorUserId?: string | null,
): Promise<void> {
  const events: ActivityInput[] = [];
  if (before.title !== after.title)
    events.push({ action: 'title', fromText: before.title, toText: after.title });
  if (before.description !== after.description)
    events.push({ action: 'description', toText: after.description });
  if (before.columnId !== after.columnId)
    events.push({
      action: 'status',
      fromText: await columnName(before.columnId),
      toText: await columnName(after.columnId),
    });
  if (before.typeId !== after.typeId)
    events.push({
      action: 'type',
      fromText: await typeName(before.typeId),
      toText: await typeName(after.typeId),
    });
  if (before.initiativeId !== after.initiativeId)
    events.push({
      action: 'initiative',
      fromText: await initiativeName(before.initiativeId),
      toText: await initiativeName(after.initiativeId),
    });
  if (before.assigneeUserId !== after.assigneeUserId)
    events.push({
      action: 'assignee',
      fromText: await userName(before.assigneeUserId),
      toText: await userName(after.assigneeUserId),
    });
  if (before.delegateUserId !== after.delegateUserId)
    events.push({
      action: 'delegate',
      fromText: await userName(before.delegateUserId),
      toText: await userName(after.delegateUserId),
    });
  if ((before.priority ?? '') !== (after.priority ?? ''))
    events.push({ action: 'priority', fromText: before.priority, toText: after.priority });
  if (before.startDate !== after.startDate)
    events.push({ action: 'start_date', fromText: before.startDate, toText: after.startDate });
  if (before.dueDate !== after.dueDate)
    events.push({ action: 'due_date', fromText: before.dueDate, toText: after.dueDate });
  const inserted = await recordActivity(after.id, events, actorUserId);

  // Inbox notifications for the two events with a dedicated notification type: a new
  // assignee, and a status change. Both link back to their activity row.
  const assigneeChanged = before.assigneeUserId !== after.assigneeUserId;
  const statusChanged = before.columnId !== after.columnId;
  if (assigneeChanged || statusChanged) {
    const idByAction = new Map(inserted.map((r) => [r.action, r.id]));
    const [row] = await db
      .select({ projectId: issue.projectId })
      .from(issue)
      .where(eq(issue.id, after.id));
    if (row) {
      await notifyIssueChange({
        projectId: row.projectId,
        issueId: after.id,
        actorUserId: actorUserId ?? null,
        assignedUserId: assigneeChanged ? after.assigneeUserId : null,
        assignedActivityId: idByAction.get('assignee') ?? null,
        statusChanged,
        statusActivityId: idByAction.get('status') ?? null,
      });
    }
  }
}
