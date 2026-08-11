import {
  db,
  issue,
  issueActivity,
  user,
  projectColumn,
  issueType,
  label,
  initiative,
  cycle,
} from '@repo/db';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { HttpError, iso } from '../shared/lib';
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

// --- Status timeline --------------------------------------------------------------
// The issue's life split into the stretches it spent in one column. Backs the
// timeline view of the activity section (a lane per column, bars on a time axis).
// The stretches carry no feed entries: what happened inside one is read on demand
// with listFeedRange when the person opens it.

export interface TimelineSegment {
  // The column name snapshot the issue was in. Null only when the issue has no
  // status history and its current column was deleted.
  status: string | null;
  from: string;
  // When the issue left this column, or null for the stretch it is in now.
  to: string | null;
  durationMs: number;
}

// Every stretch the issue spent in one column, oldest first. The boundaries are the
// 'status' entries of the change log; the first stretch starts at the issue's
// creation. The opening column is the first status change's from_text, or — for an
// issue that never changed column — its current one. Both are name snapshots, so a
// renamed column reads under the name it had at the time and splits into two lanes.
export async function listStatusTimeline(issueId: number): Promise<TimelineSegment[]> {
  const [issueRow] = await db
    .select({ createdAt: issue.createdAt, columnName: projectColumn.name })
    .from(issue)
    .leftJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(eq(issue.id, issueId));
  if (!issueRow) return [];

  const changes = await db
    .select({
      fromText: issueActivity.fromText,
      toText: issueActivity.toText,
      createdAt: issueActivity.createdAt,
    })
    .from(issueActivity)
    .where(and(eq(issueActivity.issueId, issueId), eq(issueActivity.action, 'status')))
    .orderBy(issueActivity.createdAt, issueActivity.id);

  let current: TimelineSegment = {
    status: changes[0]?.fromText ?? issueRow.columnName,
    from: iso(issueRow.createdAt),
    to: null,
    durationMs: 0,
  };
  const segments = [current];
  for (const change of changes) {
    current.to = iso(change.createdAt);
    current = { status: change.toText, from: iso(change.createdAt), to: null, durationMs: 0 };
    segments.push(current);
  }

  const now = Date.now();
  for (const segment of segments) {
    const end = segment.to ? Date.parse(segment.to) : now;
    segment.durationMs = Math.max(0, end - Date.parse(segment.from));
  }
  return segments;
}

// The feed entries written inside one stretch of the timeline: created at or after
// `from`, and before `to` (absent for the stretch the issue is in now). Oldest
// first, and unpaged — this is the slice of the activity behind a single bar of the
// timeline, opened by a deliberate click. An entry that shares its timestamp with a
// status change belongs to the stretch that change opens, which is what the
// half-open range gives.
export async function listFeedRange(
  issueId: number,
  from: string,
  to?: string | null,
): Promise<FeedItemRow[]> {
  const fromDate = new Date(from);
  const toDate = to ? new Date(to) : null;
  if (Number.isNaN(fromDate.getTime()) || (toDate && Number.isNaN(toDate.getTime())))
    throw new HttpError(400, 'from and to must be ISO datetimes');

  const rows = await db
    .select()
    .from(issueActivity)
    .where(
      and(
        eq(issueActivity.issueId, issueId),
        gte(issueActivity.createdAt, fromDate),
        toDate ? lt(issueActivity.createdAt, toDate) : undefined,
      ),
    )
    .orderBy(issueActivity.createdAt, issueActivity.id);
  return rows.map(mapFeedItem);
}

// One stretch of the grouped feed: the status the issue was in, and the entries of
// this page that were written while it was there.
export interface FeedGroup {
  status: string | null;
  from: string;
  to: string | null;
  durationMs: number;
  // The issue had already been in this status before this stretch.
  repeat: boolean;
  items: FeedItemRow[];
}

export interface GroupedFeedPage {
  groups: FeedGroup[];
  nextCursor: FeedCursor | null;
}

// The feed split into the stretches the issue spent in one column, newest first. The
// page is the window of entries listFeed serves, under the same keyset cursor, so a
// long history is read page by page rather than whole; a stretch that spans a page
// boundary is served in both, each time with the entries of that page. A stretch in
// which nothing was written carries no entries and so gets no group.
export async function listGroupedFeed(
  issueId: number,
  opts: { before?: FeedCursor | null; limit?: number } = {},
): Promise<GroupedFeedPage> {
  const page = await listFeed(issueId, opts);
  const timeline = page.items.length ? await listStatusTimeline(issueId) : [];
  if (timeline.length === 0) return { groups: [], nextCursor: page.nextCursor };

  const seen = new Set<string | null>();
  const segments = timeline.map((segment) => {
    const repeat = seen.has(segment.status);
    seen.add(segment.status);
    return { ...segment, repeat };
  });

  const groups: FeedGroup[] = [];
  // The entries run newest first and the segments oldest first, so the segment the
  // walk sits on only ever moves back towards the start.
  let index = segments.length - 1;
  for (const item of page.items) {
    const at = Date.parse(item.createdAt);
    while (index > 0 && Date.parse(segments[index].from) > at) index--;
    const segment = segments[index];
    const open = groups[groups.length - 1];
    if (open && open.from === segment.from) {
      open.items.push(item);
      continue;
    }
    groups.push({ ...segment, items: [item] });
  }
  return { groups, nextCursor: page.nextCursor };
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

// The actor behind a write: the session user's id (a member or an agent's bot
// user), null/undefined for an anonymous system write, or a named system actor
// ({ system: 'GitHub' }) whose name is stored as the entry's actor_name without a
// user behind it.
export type ActivityActor = string | null | undefined | { system: string };

// The user id of an actor, or null when it is a system write.
export function actorId(actor: ActivityActor): string | null {
  return typeof actor === 'string' ? actor : null;
}

// What a write runs on: the pool, or the transaction the caller is inside.
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Records the given events for an issue. actor_name is snapshotted from the actor
// so the entry survives the user being renamed or deleted.
export async function recordActivity(
  issueId: number,
  events: ActivityInput[],
  actor?: ActivityActor,
): Promise<{ id: number; action: string | null }[]> {
  return recordActivityEntries(
    events.map((event) => ({ issueId, event })),
    actor,
  );
}

// Records one event for a set of issues in a single insert. For the writes that
// change many issues at once (deleting a column reassigns all of its issues),
// where a recordActivity per issue would be a query each.
export async function recordActivityForIssues(
  issueIds: number[],
  event: ActivityInput,
  actor?: ActivityActor,
): Promise<void> {
  await recordActivityEntries(
    issueIds.map((issueId) => ({ issueId, event })),
    actor,
  );
}

// Records a set of (issue, event) pairs in one insert, for a write that logs a
// different event on each of the issues it touches — linking two issues writes the
// relation to both, each from its own side. `on` runs it inside the caller's
// transaction. The actor name snapshot is a sub-select, so this stays one query.
export async function recordActivityEntries(
  entries: { issueId: number; event: ActivityInput }[],
  actor?: ActivityActor,
  on: Executor = db,
): Promise<{ id: number; action: string | null }[]> {
  if (!entries.length) return [];
  const resolvedActorId = actorId(actor);
  const actorName =
    actor && typeof actor === 'object'
      ? actor.system
      : resolvedActorId
        ? sql<
            string | null
          >`(select ${user.name} from ${user} where ${user.id} = ${resolvedActorId})`
        : null;
  return on
    .insert(issueActivity)
    .values(
      entries.map(({ issueId, event }) => ({
        issueId,
        kind: 'activity' as const,
        actorUserId: resolvedActorId,
        actorName,
        action: event.action,
        subject: event.subject ?? null,
        fromText: event.fromText ?? null,
        toText: event.toText ?? null,
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
async function cycleName(id: number | null): Promise<string | null> {
  if (id == null) return null;
  const rows = await db.select({ name: cycle.name }).from(cycle).where(eq(cycle.id, id));
  return rows[0]?.name ?? null;
}
async function userName(id: string | null): Promise<string | null> {
  if (id == null) return null;
  const rows = await db.select({ name: user.name }).from(user).where(eq(user.id, id));
  return rows[0]?.name ?? null;
}
// Name snapshots for a set of labels in one query, resolved at change time so a log
// entry keeps reading correctly after a label is renamed or deleted. An id outside
// projectId, or with no label at all, is absent from the map.
export async function labelNames(projectId: number, ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (ids.length === 0) return out;
  const rows = await db
    .select({ id: label.id, name: label.name })
    .from(label)
    .where(and(eq(label.projectId, projectId), inArray(label.id, ids)));
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
  cycleId: number | null;
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
  actor?: ActivityActor,
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
  if (before.cycleId !== after.cycleId)
    events.push({
      action: 'cycle',
      fromText: await cycleName(before.cycleId),
      toText: await cycleName(after.cycleId),
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
  const inserted = await recordActivity(after.id, events, actor);

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
        actorUserId: actorId(actor),
        assignedUserId: assigneeChanged ? after.assigneeUserId : null,
        assignedActivityId: idByAction.get('assignee') ?? null,
        statusChanged,
        statusActivityId: idByAction.get('status') ?? null,
      });
    }
  }
}
