import { db, agentRun } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import { equalJitterBackoffMs } from './backoff';
import { intEnv } from './env';
import { postInternal } from './internal-api';

type Trigger = 'mention' | 'delegation' | 'schedule' | 'manual';

interface ClaimedRun {
  id: number;
  agentId: number;
  issueId: number | null;
  scheduleId: number | null;
  trigger: Trigger;
  prompt: string;
  attempts: number;
  projectId: number;
  agentUserId: string;
  agentUsername: string;
  issueIdentifier: string | null;
  issueTitle: string | null;
  assigneeName: string | null;
  assigneeUsername: string | null;
  requesterName: string | null;
  requesterUsername: string | null;
}

export async function processAgentRuns(): Promise<void> {
  const runs = await claimDueRuns();
  await Promise.all(runs.map(processRun));
}

// Only internal agents run here. An external agent's runs are claimed over HTTP by
// the operator's runner, so the worker must leave them in the queue however long
// they sit there.
async function claimDueRuns(): Promise<ClaimedRun[]> {
  const batchSize = intEnv('AGENT_RUN_BATCH_SIZE', 5);
  const leaseSeconds = intEnv('AGENT_RUN_LEASE_SECONDS', 300);
  const rows = await db.execute(sql`
    UPDATE agent_run r
    SET attempts = r.attempts + 1,
        started_at = coalesce(r.started_at, now()),
        next_attempt_at = now() + make_interval(secs => ${leaseSeconds})
    WHERE r.id IN (
      SELECT id FROM agent_run q
      WHERE q.status = 'pending' AND q.next_attempt_at <= now()
        AND (SELECT kind FROM ai_agent a WHERE a.id = q.agent_id) = 'internal'
      ORDER BY q.next_attempt_at, q.id
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    RETURNING
      r.id, r.agent_id AS "agentId", r.issue_id AS "issueId",
      r.schedule_id AS "scheduleId", r.trigger, r.prompt, r.attempts,
      (SELECT project_id FROM ai_agent a WHERE a.id = r.agent_id) AS "projectId",
      (SELECT user_id FROM ai_agent a WHERE a.id = r.agent_id) AS "agentUserId",
      (SELECT username FROM ai_agent a WHERE a.id = r.agent_id) AS "agentUsername",
      (SELECT p.key || '-' || i.sequence_number FROM issue i JOIN project p ON p.id = i.project_id WHERE i.id = r.issue_id) AS "issueIdentifier",
      (SELECT title FROM issue i WHERE i.id = r.issue_id) AS "issueTitle",
      (SELECT u.name FROM issue i JOIN "user" u ON u.id = i.assignee_user_id WHERE i.id = r.issue_id) AS "assigneeName",
      (SELECT COALESCE(u.username, ag.username) FROM issue i JOIN "user" u ON u.id = i.assignee_user_id
         LEFT JOIN ai_agent ag ON ag.user_id = u.id WHERE i.id = r.issue_id) AS "assigneeUsername",
      (SELECT actor_name FROM issue_activity a WHERE a.id = r.source_activity_id) AS "requesterName",
      (SELECT COALESCE(u.username, ag.username) FROM issue_activity a JOIN "user" u ON u.id = a.actor_user_id
         LEFT JOIN ai_agent ag ON ag.user_id = u.id WHERE a.id = r.source_activity_id) AS "requesterUsername"
  `);
  return rows as unknown as ClaimedRun[];
}

// Every write is conditional on the run still being 'pending': a run canceled while it
// was in flight keeps that outcome instead of being finished or retried.
async function processRun(run: ClaimedRun): Promise<void> {
  try {
    const { output, usage } = await executeRun(run);
    await db
      .update(agentRun)
      .set({
        status: 'success',
        output,
        lastError: null,
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        finishedAt: new Date(),
      })
      .where(and(eq(agentRun.id, run.id), eq(agentRun.status, 'pending')));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (run.attempts < intEnv('AGENT_RUN_MAX_ATTEMPTS', 3)) {
      const delaySeconds = Math.ceil(
        equalJitterBackoffMs(run.attempts, 30_000, 30 * 60_000) / 1000,
      );
      await db
        .update(agentRun)
        .set({
          nextAttemptAt: sql`now() + make_interval(secs => ${delaySeconds})`,
          lastError: message.slice(0, 500),
        })
        .where(and(eq(agentRun.id, run.id), eq(agentRun.status, 'pending')));
      return;
    }
    await db
      .update(agentRun)
      .set({ status: 'failed', lastError: message.slice(0, 500), finishedAt: new Date() })
      .where(and(eq(agentRun.id, run.id), eq(agentRun.status, 'pending')));
  }
}

// Drops the agent conversation threads of archived issues. The threads live in
// Mastra's tables, which only the api talks to, so the worker asks it over the same
// internal route it uses to run an agent. The api looks the threads up per issue, so
// the ids go in batches: the first sweep of an instance that just enabled auto-archive
// can carry thousands of them, and one request for all would run past the timeout.
export async function deleteIssueAgentThreads(issueIds: number[]): Promise<void> {
  for (let from = 0; from < issueIds.length; from += 200) {
    const response = await postInternal(
      '/internal/agent-threads/delete-for-issues',
      { issueIds: issueIds.slice(from, from + 200) },
      30_000,
    );
    if (!response.ok) throw new Error(`Agent API returned ${response.status}`);
  }
}

// `usage` is what the last model call of the run read and wrote. An api still running
// the previous build reports none, and the run is stored without counts.
async function executeRun(
  run: ClaimedRun,
): Promise<{ output: string; usage: { inputTokens: number; outputTokens: number } | null }> {
  const response = await postInternal(
    '/internal/agent-runs/execute',
    run,
    intEnv('AGENT_RUN_TIMEOUT_MS', 240_000),
  );
  const body = (await response.json().catch(() => null)) as {
    output?: string;
    error?: string;
    usage?: { inputTokens: number; outputTokens: number } | null;
  } | null;
  if (!response.ok) throw new Error(body?.error ?? `Agent API returned ${response.status}`);
  return { output: body?.output ?? '', usage: body?.usage ?? null };
}
