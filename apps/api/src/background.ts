import { intEnv } from '#shared/lib';
import { agentRunConfig } from '#modules/agents/core/run-queue';
import { processAgentRuns } from '#modules/agents/core/run-poller';
import { agentInvocationConfig, dispatchInvocations } from '#modules/agents/invocation/service';
import { pruneAgentTraces } from '#modules/agents/core/runtime/trace-retention';
import { sweepStaleIssues } from '#modules/issues/auto-archive';

// The api's background jobs, started by index.ts rather than assembled into the app,
// so importing the app in a test starts nothing. Several api replicas run them without
// overlapping: the queue is claimed with FOR UPDATE SKIP LOCKED, the archive sweep only
// touches rows it has not archived yet, and the trace sweep deletes whatever is still
// past the window.

// Each job gets a loop of its own. A run is an LLM call of minutes and a first sweep
// can carry thousands of issues, so sharing one loop would let either hold the other
// back for that long.
export function startBackgroundJobs(): void {
  startLoop('agent-runs', processAgentRuns, agentRunConfig.pollIntervalMs);
  // An external agent with an invocation URL is sent its work from a loop of its own, so
  // a slow endpoint holds back neither the runs of internal agents nor the other way.
  startLoop('agent-invocations', sendInvocations, agentInvocationConfig.pollIntervalMs);
  // Archiving is not time-sensitive, so the sweep runs far less often than the queue
  // is drained.
  startLoop('auto-archive', autoArchive, () => intEnv('AUTO_ARCHIVE_INTERVAL_MS', 3_600_000));
  startLoop('agent-traces', pruneTraces, () => intEnv('AGENT_TRACE_PRUNE_INTERVAL_MS', 3_600_000));
}

async function autoArchive(): Promise<void> {
  const archived = await sweepStaleIssues();
  if (archived > 0) console.log(`[background] auto-archived ${archived} stale issues`);
}

// Not awaited: the next tick does not wait for a slow endpoint, so the other agents are
// sent their work meanwhile.
async function sendInvocations(): Promise<void> {
  void dispatchInvocations().catch((error: unknown) =>
    console.error('[background] agent-invocations failed:', error),
  );
}

async function pruneTraces(): Promise<void> {
  const deleted = await pruneAgentTraces();
  if (deleted > 0) console.log(`[background] pruned ${deleted} agent trace spans`);
}

function startLoop(name: string, job: () => Promise<void>, intervalMs: () => number): void {
  const tick = async () => {
    try {
      await job();
    } catch (error) {
      console.error(`[background] ${name} failed:`, error);
    }
    setTimeout(tick, intervalMs()).unref();
  };
  void tick();
}
