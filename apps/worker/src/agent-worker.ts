import { enqueueDueSchedules } from './schedules';
import { intEnv } from './env';
import { startPollLoop, type WorkerHandle } from './poll-loop';

// Queues the runs of due agent schedules. Running them is the api's: the agent runtime
// and the model credentials live there, and it drains the queue itself.
export function startAgentWorker(): WorkerHandle {
  return startPollLoop('agent-worker', enqueueDueSchedules, () =>
    intEnv('AGENT_RUN_POLL_INTERVAL_MS', 2000),
  );
}
