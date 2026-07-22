import { db, issue, issueActivity, project, user } from '@repo/db';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { iso } from '../shared/lib';

// An initiative's activity feed merges two kinds of rows from issue_activity:
// events of the initiative itself (initiative_id set) and the activity of the
// issues linked to it (issue_id set, resolved through issue.initiative_id). Both
// live in one table, so the feed is one keyset-paginated query over a single id
// space. Initiative-level events are written by recordActivity/logInitiativeUpdate.

export type FeedKind = 'comment' | 'activity';

export interface InitiativeFeedItemRow {
  id: number;
  // 'initiative' for an event of the initiative itself, 'issue' for the activity
  // of a linked issue. Derived from which owner column is set.
  source: 'initiative' | 'issue';
  kind: FeedKind;
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: string | null;
  subject: string | null;
  fromText: string | null;
  toText: string | null;
  createdAt: string;
  // Set only for 'issue' rows, so the UI can link the entry to its issue.
  issueId: number | null;
  issueIdentifier: string | null;
}

// Opaque page cursor: the (created_at, id) of the last returned item. id breaks
// ties when two entries share a created_at (bulk activity from one edit).
export interface FeedCursor {
  ts: string;
  id: number;
}

export interface FeedPage {
  items: InitiativeFeedItemRow[];
  nextCursor: FeedCursor | null;
}

// One page of an initiative's feed, newest first. limit is clamped to 1..100.
export async function listFeed(
  initiativeId: number,
  opts: { before?: FeedCursor | null; limit?: number } = {},
): Promise<FeedPage> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const before = opts.before ?? null;
  const linkedIssueIds = db
    .select({ id: issue.id })
    .from(issue)
    .where(eq(issue.initiativeId, initiativeId));
  const rows = await db
    .select({
      id: issueActivity.id,
      issueId: issueActivity.issueId,
      initiativeId: issueActivity.initiativeId,
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
      seq: issue.sequenceNumber,
      projectKey: project.key,
    })
    .from(issueActivity)
    .leftJoin(issue, eq(issue.id, issueActivity.issueId))
    .leftJoin(project, eq(project.id, issue.projectId))
    .where(
      and(
        or(
          eq(issueActivity.initiativeId, initiativeId),
          inArray(issueActivity.issueId, linkedIssueIds),
        ),
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
    items: page.map((row) => ({
      id: row.id,
      source: row.initiativeId != null ? ('initiative' as const) : ('issue' as const),
      kind: row.kind as FeedKind,
      actorUserId: row.actorUserId,
      actorName: row.actorName,
      body: row.body,
      action: row.action,
      subject: row.subject,
      fromText: row.fromText,
      toText: row.toText,
      createdAt: iso(row.createdAt),
      issueId: row.issueId,
      issueIdentifier: row.seq != null && row.projectKey ? `${row.projectKey}-${row.seq}` : null,
    })),
    nextCursor: hasMore && last ? { ts: last.cursorTs, id: last.id } : null,
  };
}

// --- Activity log ----------------------------------------------------------------
// recordActivity writes initiative-level change-log entries (kind 'activity',
// initiative_id set). The initiative mutation functions call it.

export interface ActivityInput {
  action: string;
  subject?: string | null;
  fromText?: string | null;
  toText?: string | null;
}

async function userName(id: string | null): Promise<string | null> {
  if (id == null) return null;
  const rows = await db.select({ name: user.name }).from(user).where(eq(user.id, id));
  return rows[0]?.name ?? null;
}

export async function recordActivity(
  initiativeId: number,
  events: ActivityInput[],
  actorUserId?: string | null,
): Promise<void> {
  if (!events.length) return;
  const resolvedActorId = actorUserId ?? null;
  const actorName = await userName(resolvedActorId);
  await db.insert(issueActivity).values(
    events.map((e) => ({
      issueId: null,
      initiativeId,
      kind: 'activity' as const,
      actorUserId: resolvedActorId,
      actorName,
      action: e.action,
      subject: e.subject ?? null,
      fromText: e.fromText ?? null,
      toText: e.toText ?? null,
    })),
  );
}

// The subset of an initiative's fields the change log diffs.
export interface InitiativeSnapshot {
  id: number;
  title: string;
  description: string;
  status: string;
  ownerUserId: string | null;
  priority: string | null;
  startDate: string | null;
  targetDate: string | null;
}

// Diffs an initiative's before/after state and records one event per changed
// field. Owner resolves to a name snapshot (kept correct after a rename/delete);
// the rest store their raw value (the UI formats status/priority/dates).
export async function logInitiativeUpdate(
  before: InitiativeSnapshot,
  after: InitiativeSnapshot,
  actorUserId?: string | null,
): Promise<void> {
  const events: ActivityInput[] = [];
  if (before.title !== after.title)
    events.push({ action: 'title', fromText: before.title, toText: after.title });
  if (before.description !== after.description)
    events.push({ action: 'description', toText: after.description });
  if (before.status !== after.status)
    events.push({ action: 'status', fromText: before.status, toText: after.status });
  if (before.ownerUserId !== after.ownerUserId)
    events.push({
      action: 'owner',
      fromText: await userName(before.ownerUserId),
      toText: await userName(after.ownerUserId),
    });
  if ((before.priority ?? '') !== (after.priority ?? ''))
    events.push({ action: 'priority', fromText: before.priority, toText: after.priority });
  if (before.startDate !== after.startDate)
    events.push({ action: 'start_date', fromText: before.startDate, toText: after.startDate });
  if (before.targetDate !== after.targetDate)
    events.push({ action: 'target_date', fromText: before.targetDate, toText: after.targetDate });
  await recordActivity(after.id, events, actorUserId);
}
