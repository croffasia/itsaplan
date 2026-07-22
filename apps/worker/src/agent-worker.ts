import { enqueueDueSchedules } from './schedules';
import { processAgentRuns } from './agent-runs';
import { intEnv } from './env';
import { startPollLoop, type WorkerHandle } from './poll-loop';

export function startAgentWorker(): WorkerHandle {
  return startPollLoop(
    'agent-worker',
    async () => {
      await enqueueDueSchedules();
      await processAgentRuns();
    },
    () => intEnv('AGENT_RUN_POLL_INTERVAL_MS', 2000),
  );
}
