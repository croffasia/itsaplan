import { db, aiAgent, agentRun, project } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import { type ContextUsage } from '../chat-usage';
import { agentRunConfig, loadThreadContext } from '../core/run-queue';
import { recordAgentRunFinished, recordAgentRunStarted } from '../core/run-activity';
import type { AgentKind } from '../core/service';
import type { AgentRunTrigger } from '../model';
import {
  framePrompt,
  peopleContext,
  projectPreamble,
  runModePreamble,
  type RunForPrompt,
} from '../core/prompt/framing';

// The queue an external agent's runner drains. The runner is a process the operator
// starts on their own machine; it authenticates with the agent's API key, claims one
// run at a time, executes whatever command it is configured with, and reports the
// result back. The task is framed here, the same way it is for an internal agent, so
// every runner gets a task that says what started the run and what to do about it
// without having to build that itself. Claiming works exactly like the worker's: the
// row stays 'pending' and its next_attempt_at is pushed forward by a lease, so a run
// whose runner dies mid-flight becomes claimable again once the lease expires.

export interface RunnerAgent {
  id: number;
  projectId: number;
  kind: AgentKind;
  // The agent's bot user, so a run's prompts do not name the agent to itself, and
  // the handle it is addressed by.
  userId: string;
  username: string;
  // The project the agent belongs to and the operator's own instructions, both of
  // which go into the system prompt handed out with a run.
  projectKey: string;
  projectName: string;
  projectDescription: string;
  instructions: string | null;
}

// The agent whose bot user is the caller, or null when the caller is not an agent.
// The API key identifies the agent, so holding it is the authorization to drain its
// queue — no permission check applies.
export async function getRunnerAgent(userId: string): Promise<RunnerAgent | null> {
  const rows = await db
    .select({
      id: aiAgent.id,
      projectId: aiAgent.projectId,
      kind: aiAgent.kind,
      userId: aiAgent.userId,
      username: aiAgent.username,
      projectKey: project.key,
      projectName: project.name,
      projectDescription: project.description,
      instructions: aiAgent.instructions,
    })
    .from(aiAgent)
    .innerJoin(project, eq(project.id, aiAgent.projectId))
    .where(eq(aiAgent.userId, userId))
    .limit(1);
  const row = rows[0];
  return row ? { ...row, kind: row.kind as AgentKind } : null;
}

export interface RunnerRun {
  id: number;
  trigger: AgentRunTrigger;
  // The task as the agent should read it: the trigger text framed with what started
  // the run and what to do about it, the same framing an internal agent gets.
  prompt: string;
  // Instructions about the run itself — that it is autonomous, and who the people
  // behind it are — for the agent's system prompt rather than its task.
  systemPrompt: string;
  attempts: number;
  issueId: number | null;
  // The issue's human-readable key ("MKT-42"), so the runner can name the work in its
  // log. Null for a run with no issue, or a deleted one.
  issueIdentifier: string | null;
}

// The claim's raw row, before framing. The extra people columns exist only to build
// the prompts and are not handed to the runner.
type ClaimedRow = Omit<RunnerRun, 'systemPrompt'> & {
  issueTitle: string | null;
  assigneeName: string | null;
  assigneeUsername: string | null;
  requesterName: string | null;
  requesterUsername: string | null;
  sourceActivityId: number | null;
};

// Records that a runner polled, which is what the UI shows as the agent's presence.
// The chat feed calls it too: both queues are drained by the same runner.
export async function touchRunner(agentId: number): Promise<void> {
  await db.update(aiAgent).set({ lastSeenAt: new Date() }).where(eq(aiAgent.id, agentId));
}

// Fails runs that were handed out too many times without a result, so a run whose
// runner keeps dying ends in a visible state instead of being served forever. That is
// the end of the run, so the issue's timeline gets the same entry a reported failure
// writes.
async function expireExhaustedRuns(agent: RunnerAgent): Promise<void> {
  const rows = await db
    .update(agentRun)
    .set({ status: 'failed', lastError: 'Runner did not report a result', finishedAt: new Date() })
    .where(
      and(
        eq(agentRun.agentId, agent.id),
        eq(agentRun.status, 'pending'),
        sql`${agentRun.attempts} >= ${agentRunConfig.maxAttempts()}`,
        sql`${agentRun.nextAttemptAt} <= now()`,
      ),
    )
    .returning({ issueId: agentRun.issueId });
  for (const row of rows)
    await recordAgentRunFinished({ ...row, agentUserId: agent.userId }, 'failed');
}

// Claims the agent's next due run, or null when it has none. FOR UPDATE SKIP LOCKED
// keeps two runners on the same key from taking the same run.
export async function claimRunnerRun(agent: RunnerAgent): Promise<RunnerRun | null> {
  const agentId = agent.id;
  await expireExhaustedRuns(agent);
  await touchRunner(agentId);
  const rows = await db.execute(sql`
    UPDATE agent_run r
    SET attempts = r.attempts + 1,
        started_at = coalesce(r.started_at, now()),
        next_attempt_at = now() + make_interval(secs => ${agentRunConfig.leaseSeconds()})
    WHERE r.id = (
      SELECT id FROM agent_run q
      WHERE q.agent_id = ${agentId} AND q.status = 'pending' AND q.next_attempt_at <= now()
      ORDER BY q.next_attempt_at, q.id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING
      r.id,
      r.trigger,
      r.prompt,
      r.attempts,
      r.issue_id AS "issueId",
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
      r.source_activity_id AS "sourceActivityId",
      (SELECT actor_name FROM issue_activity a WHERE a.id = r.source_activity_id) AS "requesterName",
      (SELECT COALESCE(u.username, ag.username)
         FROM issue_activity a JOIN "user" u ON u.id = a.actor_user_id
         LEFT JOIN ai_agent ag ON ag.user_id = u.id
         WHERE a.id = r.source_activity_id) AS "requesterUsername"
  `);
  const row = (rows as unknown as ClaimedRow[])[0];
  if (!row) return null;
  const threadContext = await loadThreadContext(row.sourceActivityId);
  const forPrompt = {
    ...row,
    agentUserId: agent.userId,
    agentUsername: agent.username,
    threadContext,
  };
  await recordAgentRunStarted(forPrompt);
  return {
    id: row.id,
    trigger: row.trigger,
    prompt: framePrompt(forPrompt),
    systemPrompt: buildSystemPrompt(agent, forPrompt),
    attempts: row.attempts,
    issueId: row.issueId,
    issueIdentifier: row.issueIdentifier,
  };
}

// What the agent is told about the run before the task itself: the project it works
// in, that the run is autonomous, who the people behind it are, and last the
// operator's own instructions from the agent's settings, which therefore win over the
// generic parts.
function buildSystemPrompt(agent: RunnerAgent, run: RunForPrompt): string {
  const instructions = agent.instructions?.trim();
  return (
    projectPreamble({
      key: agent.projectKey,
      name: agent.projectName,
      description: agent.projectDescription,
    }) +
    runModePreamble(run.trigger) +
    peopleContext(run) +
    (instructions ? `## Instructions\n${instructions}\n` : '')
  );
}

// Extends a claimed run's lease while the runner is still working on it. A command
// can outlive the lease by far, so the runner sends this periodically; without it the
// run would be handed to another runner mid-flight. False when the run is not this
// agent's, or is already finished.
export async function heartbeatRun(agentId: number, runId: number): Promise<boolean> {
  await touchRunner(agentId);
  const rows = await db
    .update(agentRun)
    .set({ nextAttemptAt: sql`now() + make_interval(secs => ${agentRunConfig.leaseSeconds()})` })
    .where(
      and(eq(agentRun.id, runId), eq(agentRun.agentId, agentId), eq(agentRun.status, 'pending')),
    )
    .returning({ id: agentRun.id });
  return rows.length > 0;
}

// Records the outcome the runner reports. A failure is terminal: the runner ran the
// command and it failed, so re-serving the same run would just repeat it. False when
// the run is not this agent's, or was already finished.
export async function finishRun(
  agent: RunnerAgent,
  runId: number,
  result: {
    status: 'success' | 'failed';
    output?: string | null;
    error?: string | null;
    usage?: ContextUsage | null;
  },
): Promise<boolean> {
  await touchRunner(agent.id);
  const rows = await db
    .update(agentRun)
    .set({
      status: result.status,
      output: result.output?.slice(0, 10_000) ?? null,
      lastError: result.status === 'failed' ? (result.error?.slice(0, 500) ?? 'Run failed') : null,
      inputTokens: result.usage?.inputTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
      finishedAt: new Date(),
    })
    .where(
      and(eq(agentRun.id, runId), eq(agentRun.agentId, agent.id), eq(agentRun.status, 'pending')),
    )
    .returning({ issueId: agentRun.issueId });
  const row = rows[0];
  if (!row) return false;
  await recordAgentRunFinished({ ...row, agentUserId: agent.userId }, result.status);
  return true;
}
