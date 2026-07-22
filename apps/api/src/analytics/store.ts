import {
  db,
  issue,
  projectColumn,
  issueActivity,
  issueType,
  user,
  aiAgent,
  agentRun,
  webhook,
  webhookDelivery,
} from '@repo/db';
import { and, desc, eq, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import { iso } from '../shared/lib';

// Read-only project metrics for the dashboards feature. Every figure is derived
// from the existing issue / project_column / issue_activity tables — there is no
// analytics storage. This module is the only place in the API that uses GROUP BY
// and date_trunc; counts are cast to int (Postgres count() returns bigint, which
// would otherwise arrive as a string).

// The names of a project's completed-type columns. "Closed" work is detected in
// the activity log by matching a status change's to_text (a column-name snapshot)
// against these. Correct until a completed column is renamed; acceptable for the
// rolling windows the dashboards show. Historical CFD reconstruction is out of scope.
async function completedColumnNames(projectId: number): Promise<string[]> {
  const rows = await db
    .select({ name: projectColumn.name })
    .from(projectColumn)
    .where(and(eq(projectColumn.projectId, projectId), eq(projectColumn.stateType, 'completed')));
  return rows.map((r) => r.name);
}

// --- Stats -----------------------------------------------------------------------

export interface StatsDto {
  open: number;
  inProgress: number;
  backlog: number;
  overdue: number;
  unassigned: number;
  closedLast7d: number;
}

const OPEN_STATES = sql`${projectColumn.stateType} NOT IN ('completed', 'canceled')`;

export async function getStats(projectId: number): Promise<StatsDto> {
  // One row per state type with its issue count; the open/backlog/in-progress
  // figures are derived from it.
  const stateRows = await db
    .select({ stateType: projectColumn.stateType, count: sql<number>`count(*)::int` })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(eq(issue.projectId, projectId))
    .groupBy(projectColumn.stateType);

  let open = 0;
  let inProgress = 0;
  let backlog = 0;
  for (const r of stateRows) {
    if (r.stateType !== 'completed' && r.stateType !== 'canceled') open += r.count;
    if (r.stateType === 'started') inProgress = r.count;
    if (r.stateType === 'backlog') backlog = r.count;
  }

  const [{ overdue }] = await db
    .select({ overdue: sql<number>`count(*)::int` })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(and(eq(issue.projectId, projectId), sql`${issue.dueDate} < CURRENT_DATE`, OPEN_STATES));

  const [{ unassigned }] = await db
    .select({ unassigned: sql<number>`count(*)::int` })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(and(eq(issue.projectId, projectId), isNull(issue.assigneeUserId), OPEN_STATES));

  const completed = await completedColumnNames(projectId);
  let closedLast7d = 0;
  if (completed.length) {
    const [{ closed }] = await db
      .select({ closed: sql<number>`count(*)::int` })
      .from(issueActivity)
      .innerJoin(issue, eq(issue.id, issueActivity.issueId))
      .where(
        and(
          eq(issue.projectId, projectId),
          eq(issueActivity.action, 'status'),
          inArray(issueActivity.toText, completed),
          sql`${issueActivity.createdAt} >= now() - interval '7 days'`,
        ),
      );
    closedLast7d = closed;
  }

  return { open, inProgress, backlog, overdue, unassigned, closedLast7d };
}

// --- Breakdown -------------------------------------------------------------------

export type BreakdownBy = 'status' | 'priority' | 'type' | 'assignee' | 'delegate';

export interface BreakdownItem {
  key: string;
  label: string;
  count: number;
  color: string | null;
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'No priority',
};

export async function getBreakdown(projectId: number, by: BreakdownBy): Promise<BreakdownItem[]> {
  if (by === 'status') {
    // Every column, including empty ones, in work items order.
    const rows = await db
      .select({
        key: sql<string>`${projectColumn.id}::text`,
        label: projectColumn.name,
        color: projectColumn.color,
        count: sql<number>`count(${issue.id})::int`,
      })
      .from(projectColumn)
      .leftJoin(issue, eq(issue.columnId, projectColumn.id))
      .where(eq(projectColumn.projectId, projectId))
      .groupBy(projectColumn.id, projectColumn.name, projectColumn.color, projectColumn.position)
      .orderBy(projectColumn.position);
    return rows.map((r) => ({ key: r.key, label: r.label, count: r.count, color: r.color }));
  }

  if (by === 'priority') {
    const rows = await db
      .select({
        key: sql<string>`COALESCE(${issue.priority}, 'none')`,
        count: sql<number>`count(*)::int`,
      })
      .from(issue)
      .where(eq(issue.projectId, projectId))
      .groupBy(issue.priority)
      .orderBy(desc(sql`count(*)`));
    return rows.map((r) => ({
      key: r.key,
      label: PRIORITY_LABEL[r.key] ?? r.key,
      count: r.count,
      color: null,
    }));
  }

  if (by === 'type') {
    const rows = await db
      .select({
        key: sql<string>`COALESCE(${issueType.id}::text, 'none')`,
        label: sql<string>`COALESCE(${issueType.name}, 'No type')`,
        color: issueType.color,
        count: sql<number>`count(${issue.id})::int`,
      })
      .from(issue)
      .leftJoin(issueType, eq(issueType.id, issue.typeId))
      .where(eq(issue.projectId, projectId))
      .groupBy(issueType.id, issueType.name, issueType.color)
      .orderBy(desc(sql`count(${issue.id})`));
    return rows.map((r) => ({
      key: r.key,
      label: r.label,
      count: r.count,
      color: r.color ?? null,
    }));
  }

  if (by === 'delegate') {
    const rows = await db
      .select({
        key: sql<string>`COALESCE(${user.id}, 'none')`,
        label: sql<string>`COALESCE(${user.name}, 'Not delegated')`,
        count: sql<number>`count(${issue.id})::int`,
      })
      .from(issue)
      .leftJoin(user, eq(user.id, issue.delegateUserId))
      .where(eq(issue.projectId, projectId))
      .groupBy(user.id, user.name)
      .orderBy(desc(sql`count(${issue.id})`));
    return rows.map((r) => ({ key: r.key, label: r.label, count: r.count, color: null }));
  }

  // assignee
  const rows = await db
    .select({
      key: sql<string>`COALESCE(${user.id}, 'none')`,
      label: sql<string>`COALESCE(${user.name}, 'Unassigned')`,
      count: sql<number>`count(${issue.id})::int`,
    })
    .from(issue)
    .leftJoin(user, eq(user.id, issue.assigneeUserId))
    .where(eq(issue.projectId, projectId))
    .groupBy(user.id, user.name)
    .orderBy(desc(sql`count(${issue.id})`));
  return rows.map((r) => ({ key: r.key, label: r.label, count: r.count, color: null }));
}

// --- Pulse (activity heatmap) ----------------------------------------------------

export type PulseUnit = 'hour' | 'day' | 'week';

export interface PulseBucket {
  label: string;
  count: number;
}

// Per-unit heatmap geometry. `rows` cells stack in each column. `aligned` units
// snap each column to a calendar boundary so the rows carry meaning — an hour
// column is a day (rows = hours 0..23, `super` = day), a day column is a week
// (rows = Sun..Sat, `super` = week). Weeks have no such boundary, so they are
// unaligned: each column just packs `rows` consecutive weeks ending at now. fmt
// is the tooltip label (Postgres to_char pattern).
const PULSE_UNIT: Record<
  PulseUnit,
  {
    trunc: string;
    super: string;
    superField: string;
    baseField: string;
    rows: number;
    aligned: boolean;
    fmt: string;
  }
> = {
  hour: {
    trunc: 'hour',
    super: 'day',
    superField: 'days',
    baseField: 'hours',
    rows: 24,
    aligned: true,
    fmt: 'Mon DD, HH24:00',
  },
  day: {
    trunc: 'day',
    super: 'week',
    superField: 'weeks',
    baseField: 'days',
    rows: 7,
    aligned: true,
    fmt: 'Dy, Mon DD',
  },
  week: {
    trunc: 'week',
    super: 'week',
    superField: 'weeks',
    baseField: 'weeks',
    rows: 4,
    aligned: false,
    fmt: '"Week of" Mon DD',
  },
};

export function pulseRows(unit: PulseUnit): number {
  return PULSE_UNIT[unit].rows;
}

// A zero-filled activity series for the heatmap: `columns` columns of `rows` cells
// each, ending at now (see PULSE_UNIT for the geometry). Postgres generates the
// full bucket axis with generate_series and left-joins the counts, so the client
// renders the returned order directly — no client-side date math or timezone
// reconciliation. projectId and columns are validated numbers and the unit tokens
// are whitelisted, so the interpolation is injection-safe.
export async function getPulse(
  projectId: number,
  unit: PulseUnit,
  columns: number,
): Promise<PulseBucket[]> {
  const u = PULSE_UNIT[unit];
  // Both branches yield exactly columns*rows buckets. Aligned: start at the super
  // boundary `columns-1` supers back, end at the current super plus its remaining
  // cells. Unaligned: just columns*rows base units back from the current bucket.
  const range = u.aligned
    ? {
        start: `date_trunc('${u.super}', now()) - make_interval(${u.superField} => ${columns - 1})`,
        end: `date_trunc('${u.super}', now()) + make_interval(${u.baseField} => ${u.rows - 1})`,
      }
    : {
        start: `date_trunc('${u.trunc}', now()) - make_interval(${u.baseField} => ${columns * u.rows - 1})`,
        end: `date_trunc('${u.trunc}', now())`,
      };
  const q = `
    SELECT to_char(s.bucket, '${u.fmt}') AS label,
           COALESCE(count(a.id), 0)::int AS count
    FROM generate_series(${range.start}, ${range.end}, interval '1 ${u.trunc}') AS s(bucket)
    LEFT JOIN issue_activity a
      ON date_trunc('${u.trunc}', a.created_at) = s.bucket
      AND a.issue_id IN (SELECT id FROM issue WHERE project_id = ${projectId})
    GROUP BY s.bucket
    ORDER BY s.bucket
  `;
  const rows = (await db.execute(sql.raw(q))) as unknown as { label: string; count: number }[];
  return rows.map((r) => ({ label: r.label, count: Number(r.count) }));
}

// --- Throughput (created vs closed per week) -------------------------------------

export interface ThroughputWeek {
  week: string;
  created: number;
  closed: number;
}

export async function getThroughput(projectId: number, weeks: number): Promise<ThroughputWeek[]> {
  const completed = await completedColumnNames(projectId);
  const closedCond = completed.length
    ? and(eq(issueActivity.action, 'status'), inArray(issueActivity.toText, completed))
    : sql`false`;

  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${issueActivity.createdAt}), 'YYYY-MM-DD')`,
      created: sql<number>`(count(*) filter (where ${issueActivity.action} = 'created'))::int`,
      closed: sql<number>`(count(*) filter (where ${closedCond}))::int`,
    })
    .from(issueActivity)
    .innerJoin(issue, eq(issue.id, issueActivity.issueId))
    .where(
      and(
        eq(issue.projectId, projectId),
        sql`${issueActivity.createdAt} >= date_trunc('week', now()) - make_interval(weeks => ${weeks - 1})`,
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows.map((r) => ({ week: r.week, created: r.created, closed: r.closed }));
}

// --- Project-wide activity feed --------------------------------------------------

export interface ActivityCursor {
  ts: string;
  id: number;
}

export interface ActivityItem {
  id: number;
  issueId: number;
  issueSequence: number;
  issueTitle: string;
  kind: string;
  actorUserId: string | null;
  actorName: string | null;
  body: string | null;
  action: string | null;
  subject: string | null;
  fromText: string | null;
  toText: string | null;
  createdAt: string;
}

export interface ActivityPage {
  items: ActivityItem[];
  nextCursor: ActivityCursor | null;
}

// One page of the project's activity feed, newest first, keyset-paginated by
// (created_at, id) exactly like the per-issue feed. Optional filters narrow by
// action kind, actor, and — for the dashboard widget's issue filter — a set of
// issue ids the client resolved from a work items filter set. An empty issueIds array
// means "the filter matched no issues", so the feed is empty.
export async function listActivity(
  projectId: number,
  opts: {
    before?: ActivityCursor | null;
    limit?: number;
    actorUserId?: string | null;
    action?: string | null;
    issueIds?: number[] | null;
  } = {},
): Promise<ActivityPage> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const before = opts.before ?? null;

  if (opts.issueIds && opts.issueIds.length === 0) return { items: [], nextCursor: null };

  const conds = [eq(issue.projectId, projectId)];
  if (opts.issueIds) conds.push(inArray(issueActivity.issueId, opts.issueIds));
  if (opts.actorUserId != null) conds.push(eq(issueActivity.actorUserId, opts.actorUserId));
  if (opts.action) conds.push(eq(issueActivity.action, opts.action));
  if (before)
    conds.push(
      sql`(${issueActivity.createdAt}, ${issueActivity.id}) < (${before.ts}::timestamptz, ${before.id}::integer)`,
    );

  const rows = await db
    .select({
      id: issueActivity.id,
      issueId: issueActivity.issueId,
      issueSequence: issue.sequenceNumber,
      issueTitle: issue.title,
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
    .innerJoin(issue, eq(issue.id, issueActivity.issueId))
    .where(and(...conds))
    .orderBy(desc(issueActivity.createdAt), desc(issueActivity.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map((row) => ({
      id: row.id,
      // The inner join on issueActivity.issueId excludes initiative rows, so
      // issueId is always present here despite the column being nullable.
      issueId: row.issueId as number,
      issueSequence: row.issueSequence,
      issueTitle: row.issueTitle,
      kind: row.kind,
      actorUserId: row.actorUserId,
      actorName: row.actorName,
      body: row.body,
      action: row.action,
      subject: row.subject,
      fromText: row.fromText,
      toText: row.toText,
      createdAt: iso(row.createdAt),
    })),
    nextCursor: hasMore && last ? { ts: last.cursorTs, id: last.id } : null,
  };
}

// --- Agent runs (project-wide feed) ----------------------------------------------

export interface AgentRunFeedItem {
  id: number;
  status: string;
  trigger: 'mention' | 'delegation' | 'schedule' | 'manual';
  agentId: number;
  agentName: string;
  issueId: number | null;
  issueSequence: number | null;
  lastError: string | null;
  createdAt: string;
}

// The project's agent runs, newest first, optionally narrowed to one status. Joins
// agent_run through ai_agent (which carries the project scope and the agent name)
// and issue when the run is issue-triggered.
export async function listAgentRunFeed(
  projectId: number,
  opts: { status?: string | null; limit?: number } = {},
): Promise<AgentRunFeedItem[]> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const conds = [eq(aiAgent.projectId, projectId)];
  if (opts.status) conds.push(eq(agentRun.status, opts.status));

  const rows = await db
    .select({
      id: agentRun.id,
      status: agentRun.status,
      trigger: agentRun.trigger,
      agentId: agentRun.agentId,
      agentName: aiAgent.username,
      issueId: agentRun.issueId,
      issueSequence: issue.sequenceNumber,
      lastError: agentRun.lastError,
      createdAt: agentRun.createdAt,
    })
    .from(agentRun)
    .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
    .leftJoin(issue, eq(issue.id, agentRun.issueId))
    .where(and(...conds))
    .orderBy(desc(agentRun.id))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    trigger: r.trigger as AgentRunFeedItem['trigger'],
    agentId: r.agentId,
    agentName: r.agentName,
    issueId: r.issueId,
    issueSequence: r.issueSequence,
    lastError: r.lastError,
    createdAt: iso(r.createdAt),
  }));
}

// --- Agent run health (counts by status over a window) ---------------------------

export interface AgentRunStatsDto {
  total: number;
  success: number;
  failed: number;
  pending: number;
}

// Agent run outcome counts over the last `days` days for the project. Backs the
// agent health widget's success rate and failure count.
export async function getAgentRunStats(projectId: number, days: number): Promise<AgentRunStatsDto> {
  const rows = await db
    .select({ status: agentRun.status, count: sql<number>`count(*)::int` })
    .from(agentRun)
    .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
    .where(
      and(
        eq(aiAgent.projectId, projectId),
        sql`${agentRun.createdAt} >= now() - make_interval(days => ${days})`,
      ),
    )
    .groupBy(agentRun.status);

  const stats: AgentRunStatsDto = { total: 0, success: 0, failed: 0, pending: 0 };
  for (const r of rows) {
    stats.total += r.count;
    if (r.status === 'success') stats.success = r.count;
    else if (r.status === 'failed') stats.failed = r.count;
    else if (r.status === 'pending') stats.pending = r.count;
  }
  return stats;
}

// --- Webhook delivery health -----------------------------------------------------

export interface WebhookStatsDto {
  total: number;
  success: number;
  failed: number;
  pending: number;
  activeWebhooks: number;
  disabledWebhooks: number;
}

// Webhook delivery outcome counts over the last `days` days plus the current
// active/disabled subscription split (a dead endpoint is auto-disabled once its
// consecutive failures cross the worker threshold). Backs the webhook health widget.
export async function getWebhookStats(projectId: number, days: number): Promise<WebhookStatsDto> {
  const deliveryRows = await db
    .select({ status: webhookDelivery.status, count: sql<number>`count(*)::int` })
    .from(webhookDelivery)
    .innerJoin(webhook, eq(webhook.id, webhookDelivery.webhookId))
    .where(
      and(
        eq(webhook.projectId, projectId),
        sql`${webhookDelivery.createdAt} >= now() - make_interval(days => ${days})`,
      ),
    )
    .groupBy(webhookDelivery.status);

  const webhookRows = await db
    .select({ isActive: webhook.isActive, count: sql<number>`count(*)::int` })
    .from(webhook)
    .where(eq(webhook.projectId, projectId))
    .groupBy(webhook.isActive);

  const stats: WebhookStatsDto = {
    total: 0,
    success: 0,
    failed: 0,
    pending: 0,
    activeWebhooks: 0,
    disabledWebhooks: 0,
  };
  for (const r of deliveryRows) {
    stats.total += r.count;
    if (r.status === 'success') stats.success = r.count;
    else if (r.status === 'failed') stats.failed = r.count;
    else if (r.status === 'pending') stats.pending = r.count;
  }
  for (const r of webhookRows) {
    if (r.isActive) stats.activeWebhooks = r.count;
    else stats.disabledWebhooks = r.count;
  }
  return stats;
}

// --- Agent workload (per-agent delegated issues and run outcomes) ----------------

export interface AgentWorkloadItem {
  agentId: number;
  agentName: string;
  kind: string;
  delegatedOpen: number;
  runsTotal: number;
  runsSuccess: number;
  runsFailed: number;
}

// Per-agent workload for the project: how many open issues each agent is currently
// delegated, and its lifetime run outcomes. Three cheap grouped reads merged in
// memory (one per source), keyed by the agent's bot user id and agent id.
export async function getAgentWorkload(projectId: number): Promise<AgentWorkloadItem[]> {
  const agents = await db
    .select({ id: aiAgent.id, userId: aiAgent.userId, name: aiAgent.username, kind: aiAgent.kind })
    .from(aiAgent)
    .where(eq(aiAgent.projectId, projectId));
  if (agents.length === 0) return [];

  const delegatedRows = await db
    .select({ userId: issue.delegateUserId, count: sql<number>`count(*)::int` })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(and(eq(issue.projectId, projectId), isNotNull(issue.delegateUserId), OPEN_STATES))
    .groupBy(issue.delegateUserId);
  const delegatedByUser = new Map(delegatedRows.map((r) => [r.userId, r.count]));

  const runRows = await db
    .select({
      agentId: agentRun.agentId,
      total: sql<number>`count(*)::int`,
      success: sql<number>`(count(*) filter (where ${agentRun.status} = 'success'))::int`,
      failed: sql<number>`(count(*) filter (where ${agentRun.status} = 'failed'))::int`,
    })
    .from(agentRun)
    .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
    .where(eq(aiAgent.projectId, projectId))
    .groupBy(agentRun.agentId);
  const runsByAgent = new Map(runRows.map((r) => [r.agentId, r]));

  return agents
    .map((a) => {
      const runs = runsByAgent.get(a.id);
      return {
        agentId: a.id,
        agentName: a.name,
        kind: a.kind,
        delegatedOpen: delegatedByUser.get(a.userId) ?? 0,
        runsTotal: runs?.total ?? 0,
        runsSuccess: runs?.success ?? 0,
        runsFailed: runs?.failed ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.delegatedOpen - a.delegatedOpen ||
        b.runsTotal - a.runsTotal ||
        a.agentName.localeCompare(b.agentName),
    );
}
