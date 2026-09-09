import { enqueueDueSchedules } from './schedules';
import { processAgentRuns, pruneAgentTraces } from './agent-runs';
import { intEnv } from './env';
import { startPollLoop, type WorkerHandle } from './poll-loop';

let ticksSincePrune = 0;

export function startAgentWorker(): WorkerHandle {
  return startPollLoop(
    'agent-worker',
    async () => {
      await enqueueDueSchedules();
      await processAgentRuns();
      // Default ~1h at the 2s poll interval. Retention is not time-sensitive: a trace
      // one tick past its window can wait.
      if (++ticksSincePrune >= intEnv('AGENT_TRACE_PRUNE_EVERY_TICKS', 1800)) {
        ticksSincePrune = 0;
        // An unreachable api must not read as a failed tick; the next one sweeps again.
        try {
          const deleted = await pruneAgentTraces();
          if (deleted > 0) console.log(`[agent-worker] pruned ${deleted} trace spans`);
        } catch (error) {
          console.error('[agent-worker] pruning agent traces failed:', error);
        }
      }
    },
    () => intEnv('AGENT_RUN_POLL_INTERVAL_MS', 2000),
  );
}
