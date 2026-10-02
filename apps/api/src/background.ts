import { idlePollDebug, nextIdlePollMs } from '#shared/idle-poll';
import { intEnv } from '#shared/lib';
import { agentRunConfig } from '#modules/agents/core/run-queue';
import { processAgentRuns } from '#modules/agents/core/run-poller';
import { sweepStaleIssues } from '#modules/issues/auto-archive';

// The api's background jobs, started by index.ts rather than assembled into the app,
// so importing the app in a test starts nothing. Several api replicas run them without
// overlapping: the queue is claimed with FOR UPDATE SKIP LOCKED, and the sweep only
// touches rows it has not archived yet.

// Each job gets a loop of its own. A run is an LLM call of minutes and a first sweep
// can carry thousands of issues, so sharing one loop would let either hold the other
// back for that long.
export function startBackgroundJobs(): void {
  startLoop(
    'agent-runs',
    processAgentRuns,
    agentRunConfig.pollIntervalMs,
    agentRunConfig.pollIntervalMaxMs,
  );
  // Archiving is not time-sensitive, so the sweep runs far less often than the queue
  // is drained.
  startLoop('auto-archive', autoArchive, () => intEnv('AUTO_ARCHIVE_INTERVAL_MS', 3_600_000));
}

async function autoArchive(): Promise<boolean> {
  const archived = await sweepStaleIssues();
  if (archived > 0) console.log(`[background] auto-archived ${archived} stale issues`);
  // Always "busy" so the fixed hourly interval is never stretched by idle backoff.
  return true;
}

// When maxIdleMs is set, empty ticks double the wait up to that cap; a busy tick resets
// to the base. Without it the interval stays fixed.
function startLoop(
  name: string,
  tick: () => Promise<boolean>,
  intervalMs: () => number,
  maxIdleMs?: () => number,
): void {
  let emptyStreak = 0;
  const run = async () => {
    let busy = false;
    try {
      busy = await tick();
    } catch (error) {
      console.error(`[background] ${name} failed:`, error);
    }
    const base = intervalMs();
    let delay = base;
    if (maxIdleMs) {
      if (busy) emptyStreak = 0;
      else {
        delay = nextIdlePollMs(emptyStreak, base, maxIdleMs());
        idlePollDebug(`background/${name}`, delay, emptyStreak);
        emptyStreak += 1;
      }
    }
    setTimeout(run, delay).unref();
  };
  void run();
}
