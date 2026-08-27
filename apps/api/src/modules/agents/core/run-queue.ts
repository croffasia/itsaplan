import { db, agentRun, issue, project } from '@repo/db';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { iso } from '#shared/lib';
import type { AgentRunTrigger } from '../model';
import { intEnv } from './helpers/env';

// The agent_run outbox: data access for issue-triggered runs and run history. The
// background worker claims pending rows, calls the internal runtime route, and
// records the outcome.

// Tuning, env-overridable with defaults. An agent run is an LLM call that can take
// tens of seconds, so the lease is generous — it must exceed a run's wall time so a
// row is not re-claimed while its run is still in flight.
export const agentRunConfig = {
  pollIntervalMs: () => intEnv('AGENT_RUN_POLL_INTERVAL_MS', 2000),
  batchSize: () => intEnv('AGENT_RUN_BATCH_SIZE', 5),
  maxAttempts: () => intEnv('AGENT_RUN_MAX_ATTEMPTS', 3),
  leaseSeconds: () => intEnv('AGENT_RUN_LEASE_SECONDS', 300),
};

export async function enqueueAgentRun(input: {
  agentId: number;
  issueId: number;
  sourceActivityId: number | null;
  prompt: string;
  trigger?: 'mention' | 'delegation' | 'field';
  // Seconds the run stays unclaimable after it is queued, so the issue can still be
  // edited before the agent reads it.
  delaySeconds?: number;
}): Promise<void> {
  const delay = Math.max(0, Math.trunc(input.delaySeconds ?? 0));
  await db.insert(agentRun).values({
    agentId: input.agentId,
    issueId: input.issueId,
    sourceActivityId: input.sourceActivityId,
    prompt: input.prompt,
    trigger: input.trigger ?? (input.sourceActivityId == null ? 'delegation' : 'mention'),
    nextAttemptAt: delay > 0 ? sql`now() + make_interval(secs => ${delay})` : undefined,
  });
}

export interface ClaimedRun {
  id: number;
  agentId: number;
  issueId: number;
  prompt: string;
  attempts: number;
  // The source comment id when the run was triggered by a mention, null for a
  // delegation. The poller frames the task differently for each.
  sourceActivityId: number | null;
  // The agent's project and bot user, read inline so the poller can run it without a
  // second query.
  projectId: number;
  agentUserId: string;
  // The agent's own handle, so the prompt can tell whether the text addressed it.
  agentUsername: string;
  // The issue's human-readable key ("MKT-42") and title, read inline so the poller can
  // frame the run with them. Null if the issue was deleted after enqueue.
  issueIdentifier: string | null;
  issueTitle: string | null;
  // The issue's assignee (the responsible human) and, for a mention run, the author of
  // the comment that mentioned the agent (from the source activity's name snapshot).
  // Each carries the handle the agent tags them by. Any may be null: no assignee, a
  // deleted user, or a run with no source comment.
  assigneeName: string | null;
  assigneeUsername: string | null;
  requesterName: string | null;
  requesterUsername: string | null;
  // The comments the source comment replies to, oldest first, when it is a reply.
  // Null for a top-level mention or a delegation.
  threadContext: string | null;
}

// Atomically claims up to batchSize due runs of internal agents. FOR UPDATE SKIP
// LOCKED lets more than one API replica run without ever claiming the same row.
// Claiming bumps attempts and pushes next_attempt_at forward by the lease while
// keeping status 'pending', so a run whose poller crashes mid-flight becomes
// claimable again after the lease — no separate recovery pass. The agent's
// project_id and user_id are read inline. An external agent's runs are left alone:
// they are claimed over HTTP by the operator's runner (modules/agents/runner).
export async function claimDueRuns(): Promise<ClaimedRun[]> {
  const batchSize = agentRunConfig.batchSize();
  const leaseSeconds = agentRunConfig.leaseSeconds();
  const rows = await db.execute(sql`
    UPDATE agent_run r
    SET attempts = r.attempts + 1,
        next_attempt_at = now() + make_interval(secs => ${leaseSeconds})
    WHERE r.id IN (
      SELECT id FROM agent_run q
      WHERE q.status = 'pending' AND q.next_attempt_at <= now()
        AND (SELECT kind FROM ai_agent a WHERE a.id = q.agent_id) = 'internal'
      ORDER BY q.next_attempt_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    RETURNING
      r.id,
      r.agent_id AS "agentId",
      r.issue_id AS "issueId",
      r.prompt,
      r.attempts,
      r.source_activity_id AS "sourceActivityId",
      (SELECT project_id FROM ai_agent a WHERE a.id = r.agent_id) AS "projectId",
      (SELECT user_id FROM ai_agent a WHERE a.id = r.agent_id) AS "agentUserId",
      (SELECT username FROM ai_agent a WHERE a.id = r.agent_id) AS "agentUsername",
      (SELECT p.key || '-' || i.sequence_number
         FROM issue i JOIN project p ON p.id = i.project_id
         WHERE i.id = r.issue_id) AS "issueIdentifier",
      (SELECT title FROM issue i WHERE i.id = r.issue_id) AS "issueTitle",
      (SELECT u.name FROM issue i JOIN "user" u ON u.id = i.assignee_user_id
         WHERE i.id = r.issue_id) AS "assigneeName",
      (SELECT COALESCE(u.username, ag.username)
         FROM issue i JOIN "user" u ON u.id = i.assignee_user_id
         LEFT JOIN ai_agent ag ON ag.user_id = u.id
         WHERE i.id = r.issue_id) AS "assigneeUsername",
      (SELECT actor_name FROM issue_activity a WHERE a.id = r.source_activity_id) AS "requesterName",
      (SELECT COALESCE(u.username, ag.username)
         FROM issue_activity a JOIN "user" u ON u.id = a.actor_user_id
         LEFT JOIN ai_agent ag ON ag.user_id = u.id
         WHERE a.id = r.source_activity_id) AS "requesterUsername"
  `);
  const runs = rows as unknown as ClaimedRun[];
  return Promise.all(
    runs.map(async (run) => ({
      ...run,
      threadContext: await loadThreadContext(run.sourceActivityId),
    })),
  );
}

// How far up a thread the agent is given. Further up, the exchange is too far from
// the question to pay for the tokens it costs.
const THREAD_CONTEXT_DEPTH = 5;

// The comments the given one replies to, oldest first and at most
// THREAD_CONTEXT_DEPTH of them, as the text a prompt carries. Null when the comment
// is not a reply.
export async function loadThreadContext(sourceActivityId: number | null): Promise<string | null> {
  if (sourceActivityId == null) return null;
  const rows = await db.execute(sql`
    WITH RECURSIVE chain AS (
      SELECT a.id, a.reply_to_id, a.actor_name, a.body, 0 AS depth
        FROM issue_activity a
       WHERE a.id = ${sourceActivityId}
      UNION ALL
      SELECT p.id, p.reply_to_id, p.actor_name, p.body, c.depth + 1
        FROM issue_activity p
        JOIN chain c ON p.id = c.reply_to_id
       WHERE c.depth < ${THREAD_CONTEXT_DEPTH}
    )
    SELECT actor_name AS "actorName", body FROM chain WHERE depth > 0 ORDER BY depth DESC
  `);
  const ancestors = rows as unknown as { actorName: string | null; body: string | null }[];
  if (ancestors.length === 0) return null;
  return ancestors.map((a) => `${a.actorName ?? 'Unknown'}: ${a.body ?? ''}`).join('\n\n');
}

// A run canceled while it was in flight keeps that outcome: each of these writes only
// where the row is still 'pending'.
export async function markRunSuccess(id: number): Promise<void> {
  await db
    .update(agentRun)
    .set({ status: 'success', lastError: null })
    .where(and(eq(agentRun.id, id), eq(agentRun.status, 'pending')));
}

export async function scheduleRunRetry(id: number, delayMs: number, error: string): Promise<void> {
  const delaySeconds = Math.max(1, Math.ceil(delayMs / 1000));
  await db
    .update(agentRun)
    .set({
      status: 'pending',
      nextAttemptAt: sql`now() + make_interval(secs => ${delaySeconds})`,
      lastError: error.slice(0, 500),
    })
    .where(and(eq(agentRun.id, id), eq(agentRun.status, 'pending')));
}

export async function markRunFailed(id: number, error: string): Promise<void> {
  await db
    .update(agentRun)
    .set({ status: 'failed', lastError: error.slice(0, 500) })
    .where(and(eq(agentRun.id, id), eq(agentRun.status, 'pending')));
}

// One row of an agent's run history, for the runs sidebar. The issue is joined for
// its human key and title.
export interface AgentRunRow {
  id: number;
  status: string;
  trigger: AgentRunTrigger;
  issueId: number | null;
  issueIdentifier: string | null;
  issueTitle: string | null;
  prompt: string;
  attempts: number;
  lastError: string | null;
  // What the run produced: the runtime's reply, or whatever the runner's command
  // printed. Null until the run finishes.
  output: string | null;
  contextTokens?: number;
  nextAttemptAt: string;
  createdAt: string;
}

// The size of a run's context as its DTO carries it. The field is left out where there
// is nothing to report: a run stored before the counts were recorded, and one whose
// agent reports none.
export function contextTokensOf(row: { inputTokens: number | null; outputTokens: number | null }): {
  contextTokens?: number;
} {
  if (row.inputTokens == null && row.outputTokens == null) return {};
  return { contextTokens: (row.inputTokens ?? 0) + (row.outputTokens ?? 0) };
}

export interface AgentRunPage {
  items: AgentRunRow[];
  // The id to pass as `before` to load the next page, or null when at the end.
  nextCursor: number | null;
}

// One page of an agent's runs, newest first. Keyset pagination by id (runs are
// id-monotonic): pass the previous page's nextCursor as `before`. limit is clamped to
// 1..50.
export async function listAgentRuns(
  agentId: number,
  opts: { before?: number; limit?: number } = {},
): Promise<AgentRunPage> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 50);
  const rows = await db
    .select({
      id: agentRun.id,
      status: agentRun.status,
      trigger: agentRun.trigger,
      issueId: agentRun.issueId,
      prompt: agentRun.prompt,
      attempts: agentRun.attempts,
      lastError: agentRun.lastError,
      output: agentRun.output,
      inputTokens: agentRun.inputTokens,
      outputTokens: agentRun.outputTokens,
      nextAttemptAt: agentRun.nextAttemptAt,
      createdAt: agentRun.createdAt,
      issueSeq: issue.sequenceNumber,
      issueTitle: issue.title,
      projectKey: project.key,
    })
    .from(agentRun)
    .leftJoin(issue, eq(issue.id, agentRun.issueId))
    .leftJoin(project, eq(project.id, issue.projectId))
    .where(
      and(eq(agentRun.agentId, agentId), opts.before ? lt(agentRun.id, opts.before) : undefined),
    )
    .orderBy(desc(agentRun.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map((r) => ({
      id: r.id,
      status: r.status,
      trigger: r.trigger as AgentRunTrigger,
      issueId: r.issueId,
      issueIdentifier: r.projectKey && r.issueSeq != null ? `${r.projectKey}-${r.issueSeq}` : null,
      issueTitle: r.issueTitle ?? null,
      prompt: r.prompt,
      attempts: r.attempts,
      lastError: r.lastError,
      output: r.output,
      ...contextTokensOf(r),
      nextAttemptAt: iso(r.nextAttemptAt),
      createdAt: iso(r.createdAt),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
