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
  type ActivityPayload,
  type ActivitySide,
} from '@repo/db';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import { emitWebhookEvent } from '#modules/webhooks/emit';
import { parseMentionHandles, resolveMentionHandles } from '#shared/mentions';
import { isAgentUser, listMentionTriggerAgents } from '#modules/agents/core/service';
import { enqueueAgentRun } from '#modules/agents/core/run-queue';
import {
  notifyComment,
  notifyIssueChange,
  notifyTextMentions,
} from '#modules/notifications/service';
import { listStatusTimeline } from './status-history';

// Issue timeline: comments and change-log activity in one table (issue_activity).
// kind selects which columns a row uses. The author is the session user
// (a member or an agent's bot user); actor_name is a snapshot taken at write time,
// so an entry keeps reading correctly after that user is renamed or deleted. The
// issue detail panel renders the feed newest first and pages through it with a
// (created_at, id) keyset cursor.

export type FeedKind = 'comment' | 'activity';

export interface FeedItemRow {
  id: number;
  issueId: number;
  kind: FeedKind;
  // The comment this one replies to, null for a top-level entry.
  replyToId: number | null;
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: string | null;
  payload: ActivityPayload;
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
  replyToId: number | null;
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: string | null;
  payload: ActivityPayload;
  createdAt: Date;
}): FeedItemRow {
  return {
    id: row.id,
    issueId: row.issueId as number,
    kind: row.kind as FeedKind,
    replyToId: row.replyToId,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    body: row.body,
    action: row.action,
    payload: row.payload,
    createdAt: iso(row.createdAt),
  };
}

// One page of an issue's feed, newest first. The page is a window over the
// top-level entries; the replies of the comments in it follow at the end of items,
// however deep they are nested, so a thread is never split across pages. cursor_ts
// is created_at as full-precision text so the returned nextCursor round-trips
// without the millisecond truncation iso() would apply. limit is clamped to 1..100.
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
      replyToId: issueActivity.replyToId,
      actorUserId: issueActivity.actorUserId,
      actorName: issueActivity.actorName,
      body: issueActivity.body,
      action: issueActivity.action,
      payload: issueActivity.payload,
      createdAt: issueActivity.createdAt,
      cursorTs: sql<string>`${issueActivity.createdAt}::text`,
    })
    .from(issueActivity)
    .where(
      and(
        eq(issueActivity.issueId, issueId),
        isNull(issueActivity.replyToId),
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
  const items = page.map(mapFeedItem);
  const replies = await listReplies(items.map((item) => item.id));
  return {
    items: [...items, ...replies],
    nextCursor: hasMore && last ? { ts: last.cursorTs, id: last.id } : null,
  };
}

// Every reply under the given entries, oldest first, read one level at a time until
// a level has none. A thread is a handful of comments deep, so the loop is short and
// each level is one query.
async function listReplies(parentIds: number[]): Promise<FeedItemRow[]> {
  const replies: FeedItemRow[] = [];
  let level = parentIds;
  while (level.length > 0) {
    const rows = await db
      .select()
      .from(issueActivity)
      .where(inArray(issueActivity.replyToId, level))
      .orderBy(issueActivity.createdAt, issueActivity.id);
    replies.push(...rows.map(mapFeedItem));
    level = rows.map((row) => row.id);
  }
  return replies;
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
  // A reply joins the group of the thread it hangs under, wherever the issue stood
  // when it was written, so the thread stays whole.
  const groupByItemId = new Map<number, FeedGroup>();
  // The entries run newest first and the segments oldest first, so the segment the
  // walk sits on only ever moves back towards the start.
  let index = segments.length - 1;
  for (const item of page.items) {
    if (item.replyToId != null) {
      const group = groupByItemId.get(item.replyToId);
      if (!group) continue;
      group.items.push(item);
      groupByItemId.set(item.id, group);
      continue;
    }
    const at = Date.parse(item.createdAt);
    while (index > 0 && Date.parse(segments[index].from) > at) index--;
    const segment = segments[index];
    const open = groups[groups.length - 1];
    if (open && open.from === segment.from) {
      open.items.push(item);
      groupByItemId.set(item.id, open);
      continue;
    }
    const group = { ...segment, items: [item] };
    groups.push(group);
    groupByItemId.set(item.id, group);
  }
  return { groups, nextCursor: page.nextCursor };
}

export async function createComment(input: {
  issueId: number;
  actorUserId?: string | null;
  body: string;
  // The comment being replied to. It has to be a comment on the same issue.
  replyToId?: number | null;
}): Promise<FeedItemRow> {
  const actorUserId = input.actorUserId ?? null;
  const actorName = await userName(actorUserId);
  const replyToId = input.replyToId ?? null;
  if (replyToId != null) {
    const [parent] = await db
      .select({ issueId: issueActivity.issueId, kind: issueActivity.kind })
      .from(issueActivity)
      .where(eq(issueActivity.id, replyToId));
    if (!parent || parent.issueId !== input.issueId || parent.kind !== 'comment')
      throw new HttpError(400, 'replyToId must be a comment on this issue');
  }
  const [row] = await db
    .insert(issueActivity)
    .values({
      issueId: input.issueId,
      kind: 'comment',
      replyToId,
      actorUserId,
      actorName,
      body: input.body,
    })
    .returning();
  const comment = mapFeedItem(row);

  const projectRows = await db
    .select({ projectId: issue.projectId })
    .from(issue)
    .where(eq(issue.id, input.issueId));
  const projectId = projectRows[0]?.projectId;
  if (projectId != null) {
    await emitWebhookEvent(projectId, 'comment.created', comment);
    // Resolved once: the agent halves start runs, the member half is notified.
    const mentioned = await resolveMentionHandles(
      projectId,
      parseMentionHandles(comment.body ?? ''),
    );
    await enqueueMentionRuns(projectId, comment, mentioned.agentUserIds);
    await notifyComment(projectId, comment, mentioned);
  }

  return comment;
}

// If the comment reaches agents, queue a run for each so they can reply. A mention
// reaches the agents it names; a reply reaches the author of the comment it answers,
// so answering an agent in its own thread does not have to tag it again. Only quick
// queries run here; the work happens later — in the poller for an internal agent, on
// the operator's runner for an external one — so creating a comment is never blocked
// on it. Comments authored by an agent's bot user never trigger runs, which stops
// agents from setting each other (or themselves) off.
async function enqueueMentionRuns(
  projectId: number,
  comment: FeedItemRow,
  mentionedAgentUserIds: string[],
): Promise<void> {
  if (mentionedAgentUserIds.length === 0 && comment.replyToId == null) return;
  if (comment.actorUserId && (await isAgentUser(comment.actorUserId))) return;
  const reachedUserIds = new Set(mentionedAgentUserIds);
  if (comment.replyToId != null) {
    const [parent] = await db
      .select({ actorUserId: issueActivity.actorUserId })
      .from(issueActivity)
      .where(eq(issueActivity.id, comment.replyToId));
    if (parent?.actorUserId) reachedUserIds.add(parent.actorUserId);
  }
  const agents = await listMentionTriggerAgents(
    projectId,
    [...reachedUserIds],
    comment.actorUserId,
  );
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

// Every side of every entry is built here, so the log holds one shape: the text as
// the feed shows it, and the id of the row behind it wherever there is one.

// A value with no row of its own — a title, a priority, a date. Dropped when there
// is nothing to say.
export function textSide(value: string | null | undefined): ActivitySide | undefined {
  return value == null ? undefined : { value };
}

// A value that names a row: its text snapshot, so the entry keeps reading after a
// rename or a delete, and its id, so the entry stays readable as data. Falls back to
// text when there is no row behind the value.
export function rowSide(
  value: string | null | undefined,
  id: number | string | null | undefined,
): ActivitySide | undefined {
  return id == null ? textSide(value) : { value: value ?? null, id };
}

// The side a status change writes: the column, plus the state type it carries at
// this moment — what it was later is not recoverable, and the metrics read it.
export function statusSide(column: { id: number; name: string; stateType: string }): ActivitySide {
  return { value: column.name, id: column.id, stateType: column.stateType };
}

export interface ActivityInput extends ActivityPayload {
  action: string;
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
      entries.map(({ issueId, event: { action, ...payload } }) => ({
        issueId,
        kind: 'activity' as const,
        actorUserId: resolvedActorId,
        actorName,
        action,
        payload,
      })),
    )
    .returning({ id: issueActivity.id, action: issueActivity.action });
}

// The sides that read their text from the row they name, looked up at change time.
async function columnSide(id: number | null): Promise<ActivitySide | undefined> {
  if (id == null) return undefined;
  const rows = await db
    .select({ id: projectColumn.id, name: projectColumn.name, stateType: projectColumn.stateType })
    .from(projectColumn)
    .where(eq(projectColumn.id, id));
  return rows[0] ? statusSide(rows[0]) : undefined;
}
async function typeSide(id: number | null): Promise<ActivitySide | undefined> {
  if (id == null) return undefined;
  const rows = await db
    .select({ name: issueType.name })
    .from(issueType)
    .where(eq(issueType.id, id));
  return rowSide(rows[0]?.name, id);
}
async function initiativeSide(id: number | null): Promise<ActivitySide | undefined> {
  if (id == null) return undefined;
  const rows = await db
    .select({ title: initiative.title })
    .from(initiative)
    .where(eq(initiative.id, id));
  return rowSide(rows[0]?.title, id);
}
async function cycleSide(id: number | null): Promise<ActivitySide | undefined> {
  if (id == null) return undefined;
  const rows = await db.select({ name: cycle.name }).from(cycle).where(eq(cycle.id, id));
  return rowSide(rows[0]?.name, id);
}
export async function userSide(id: string | null): Promise<ActivitySide | undefined> {
  return rowSide(await userName(id), id);
}
export async function userName(id: string | null): Promise<string | null> {
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
  estimatePoints: number | null;
  estimateMinutes: number | null;
  startDate: string | null;
  dueDate: string | null;
}

// A duration as the feed shows it, the same wording the issue properties use:
// 90 -> '1h 30m', 120 -> '2h', 30 -> '30m'.
export function timeText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function estimateTimeText(minutes: number | null): string | null {
  return minutes == null ? null : timeText(minutes);
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
    events.push({ action: 'title', from: textSide(before.title), to: textSide(after.title) });
  if (before.description !== after.description)
    events.push({ action: 'description', to: textSide(after.description) });
  if (before.columnId !== after.columnId)
    events.push({
      action: 'status',
      from: await columnSide(before.columnId),
      to: await columnSide(after.columnId),
    });
  if (before.typeId !== after.typeId)
    events.push({
      action: 'type',
      from: await typeSide(before.typeId),
      to: await typeSide(after.typeId),
    });
  if (before.initiativeId !== after.initiativeId)
    events.push({
      action: 'initiative',
      from: await initiativeSide(before.initiativeId),
      to: await initiativeSide(after.initiativeId),
    });
  if (before.cycleId !== after.cycleId)
    events.push({
      action: 'cycle',
      from: await cycleSide(before.cycleId),
      to: await cycleSide(after.cycleId),
    });
  if (before.assigneeUserId !== after.assigneeUserId)
    events.push({
      action: 'assignee',
      from: await userSide(before.assigneeUserId),
      to: await userSide(after.assigneeUserId),
    });
  if (before.delegateUserId !== after.delegateUserId)
    events.push({
      action: 'delegate',
      from: await userSide(before.delegateUserId),
      to: await userSide(after.delegateUserId),
    });
  if ((before.priority ?? '') !== (after.priority ?? ''))
    events.push({
      action: 'priority',
      from: textSide(before.priority),
      to: textSide(after.priority),
    });
  if (before.estimatePoints !== after.estimatePoints)
    events.push({
      action: 'estimate',
      subject: { value: 'points' },
      from: textSide(before.estimatePoints?.toString()),
      to: textSide(after.estimatePoints?.toString()),
    });
  if (before.estimateMinutes !== after.estimateMinutes)
    events.push({
      action: 'estimate',
      subject: { value: 'time' },
      from: textSide(estimateTimeText(before.estimateMinutes)),
      to: textSide(estimateTimeText(after.estimateMinutes)),
    });
  if (before.startDate !== after.startDate)
    events.push({
      action: 'start_date',
      from: textSide(before.startDate),
      to: textSide(after.startDate),
    });
  if (before.dueDate !== after.dueDate)
    events.push({
      action: 'due_date',
      from: textSide(before.dueDate),
      to: textSide(after.dueDate),
    });
  const inserted = await recordActivity(after.id, events, actor);

  // Inbox notifications for the events with a dedicated notification type: a new
  // assignee, a status change, and the mentions a rewritten description added. Each
  // links back to its activity row.
  const assigneeChanged = before.assigneeUserId !== after.assigneeUserId;
  const statusChanged = before.columnId !== after.columnId;
  const descriptionChanged = before.description !== after.description;
  if (!assigneeChanged && !statusChanged && !descriptionChanged) return;
  const [row] = await db
    .select({ projectId: issue.projectId })
    .from(issue)
    .where(eq(issue.id, after.id));
  if (!row) return;

  const idByAction = new Map(inserted.map((r) => [r.action, r.id]));
  if (assigneeChanged || statusChanged) {
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
  if (descriptionChanged) {
    await notifyTextMentions({
      projectId: row.projectId,
      issueId: after.id,
      actorUserId: actorId(actor),
      sourceActivityId: idByAction.get('description') ?? null,
      before: before.description,
      after: after.description,
    });
  }
}
