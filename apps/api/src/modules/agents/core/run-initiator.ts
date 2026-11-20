import { AsyncLocalStorage } from 'node:async_hooks';
import { db, agentRun, aiAgent } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import { executionState } from './run-queue';

// Where a queued run comes from (see "Run initiator" and "Run origin" in docs/dev/agents.md).
// When an agent queues a run, the new run keeps the initiator of the work the agent does,
// so a chain of agents stays the work of the person or the project that started it. The
// initiator is never read from a request.
export interface RunOrigin {
  requestedByUserId: string | null;
  startedByUserId: string | null;
  parentRunId: number | null;
}

// What an agent works on: the initiator and its queued run, null in a chat.
export interface AgentWork {
  initiator: string | null;
  runId: number | null;
}

const working = new AsyncLocalStorage<AgentWork>();

// Runs a tool call an agent makes as part of `work`: an internal agent's in its run or
// chat, an external agent's over MCP in the run its client names.
export function actFor<T>(work: AgentWork | null, call: () => Promise<T>): Promise<T> {
  return work ? working.run(work, call) : call();
}

// The header an external agent's MCP client sends with the run it works on, the
// ITSAPLAN_RUN_ID the runner sets for the command it starts.
const RUN_HEADER = 'x-itsaplan-run-id';

// The work of the run an external agent names, when that run is the agent's and runs now.
// Any other run names no work, so an agent cannot act for the person of a run not its own.
export async function namedRunWork(
  agentUserId: string,
  headers: Headers,
): Promise<AgentWork | null> {
  const runId = Number(headers.get(RUN_HEADER));
  if (!Number.isSafeInteger(runId) || runId <= 0) return null;
  const [run] = await db
    .select({ initiator: agentRun.requestedByUserId, runId: agentRun.id })
    .from(agentRun)
    .innerJoin(aiAgent, eq(aiAgent.id, agentRun.agentId))
    .where(
      and(
        eq(agentRun.id, runId),
        eq(aiAgent.userId, agentUserId),
        sql`${executionState} = 'running'`,
      ),
    );
  return run ?? null;
}

// An agent outside any work, such as one whose calls name no run, queues the project's work.
export async function runOrigin(actorUserId: string | null | undefined): Promise<RunOrigin> {
  if (!actorUserId) return { requestedByUserId: null, startedByUserId: null, parentRunId: null };
  const [agent] = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(eq(aiAgent.userId, actorUserId));
  if (!agent) {
    return { requestedByUserId: actorUserId, startedByUserId: actorUserId, parentRunId: null };
  }
  const work = working.getStore();
  return {
    requestedByUserId: work?.initiator ?? null,
    startedByUserId: actorUserId,
    parentRunId: work?.runId ?? null,
  };
}
