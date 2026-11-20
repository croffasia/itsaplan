import { AsyncLocalStorage } from 'node:async_hooks';
import { db, agentRun, aiAgent } from '@repo/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import { executionState } from './run-queue';

// The person a queued run is for, kept in agent_run.requested_by_user_id: who mentioned
// the agent, delegated to it, set it in a field or sent it an API task. When an agent sets
// another agent to work, the new run is for the person the first agent was working for, so
// a chain of agents stays the work of the person who started it. Null is the project's own
// work, such as a schedule's run, and what a chain started by it leads to.

const actingFor = new AsyncLocalStorage<string | null>();

// Runs a tool call an internal agent makes in a run or a chat as work for `initiator`.
export function actFor<T>(initiator: string | null, work: () => Promise<T>): Promise<T> {
  return actingFor.run(initiator, work);
}

// An external agent calls the api on its own, so the run it is at work on names its
// person, the one on `issueId` first. At work on two runs elsewhere, it passes on the
// latest one's person; a run id sent with its calls would name the right one.
export async function runInitiator(
  actorUserId: string | null | undefined,
  issueId?: number | null,
): Promise<string | null> {
  if (!actorUserId) return null;
  const [agent] = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(eq(aiAgent.userId, actorUserId));
  if (!agent) return actorUserId;
  const inherited = actingFor.getStore();
  if (inherited !== undefined) return inherited;
  const [run] = await db
    .select({ initiator: agentRun.requestedByUserId })
    .from(agentRun)
    .where(and(eq(agentRun.agentId, agent.id), sql`${executionState} = 'running'`))
    .orderBy(
      ...(issueId != null ? [sql`${agentRun.issueId} = ${issueId} DESC NULLS LAST`] : []),
      desc(agentRun.startedAt),
    )
    .limit(1);
  return run?.initiator ?? null;
}
