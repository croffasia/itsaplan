import { db, agentRun } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
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
  issueIdentifier: string | null;
  issueTitle: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  requesterUserId: string | null;
  requesterName: string | null;
}

export async function processAgentRuns(): Promise<void> {
  const runs = await claimDueRuns();
  await Promise.all(runs.map(processRun));
}

async function claimDueRuns(): Promise<ClaimedRun[]> {
  const batchSize = intEnv('AGENT_RUN_BATCH_SIZE', 5);
  const leaseSeconds = intEnv('AGENT_RUN_LEASE_SECONDS', 300);
  const rows = await db.execute(sql`
    UPDATE agent_run r
    SET attempts = r.attempts + 1,
        started_at = coalesce(r.started_at, now()),
        next_attempt_at = now() + make_interval(secs => ${leaseSeconds})
    WHERE r.id IN (
      SELECT id FROM agent_run
      WHERE status = 'pending' AND next_attempt_at <= now()
      ORDER BY next_attempt_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    RETURNING
      r.id, r.agent_id AS "agentId", r.issue_id AS "issueId",
      r.schedule_id AS "scheduleId", r.trigger, r.prompt, r.attempts,
      (SELECT project_id FROM ai_agent a WHERE a.id = r.agent_id) AS "projectId",
      (SELECT user_id FROM ai_agent a WHERE a.id = r.agent_id) AS "agentUserId",
      (SELECT p.key || '-' || i.sequence_number FROM issue i JOIN project p ON p.id = i.project_id WHERE i.id = r.issue_id) AS "issueIdentifier",
      (SELECT title FROM issue i WHERE i.id = r.issue_id) AS "issueTitle",
      (SELECT assignee_user_id FROM issue i WHERE i.id = r.issue_id) AS "assigneeUserId",
      (SELECT u.name FROM issue i JOIN "user" u ON u.id = i.assignee_user_id WHERE i.id = r.issue_id) AS "assigneeName",
      (SELECT actor_user_id FROM issue_activity a WHERE a.id = r.source_activity_id) AS "requesterUserId",
      (SELECT actor_name FROM issue_activity a WHERE a.id = r.source_activity_id) AS "requesterName"
  `);
  return rows as unknown as ClaimedRun[];
}

async function processRun(run: ClaimedRun): Promise<void> {
  try {
    const output = await executeRun(run);
    await db
      .update(agentRun)
      .set({ status: 'success', output, lastError: null, finishedAt: new Date() })
      .where(eq(agentRun.id, run.id));
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
        .where(eq(agentRun.id, run.id));
      return;
    }
    await db
      .update(agentRun)
      .set({ status: 'failed', lastError: message.slice(0, 500), finishedAt: new Date() })
      .where(eq(agentRun.id, run.id));
  }
}

async function executeRun(run: ClaimedRun): Promise<string> {
  const response = await postInternal(
    '/internal/agent-runs/execute',
    run,
    intEnv('AGENT_RUN_TIMEOUT_MS', 240_000),
  );
  const body = (await response.json().catch(() => null)) as {
    output?: string;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(body?.error ?? `Agent API returned ${response.status}`);
  return body?.output ?? '';
}
