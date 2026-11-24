import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { runnerQueuePath } from '@/utils/paths';

// The address of a run: under the page that lists it, or else its own project's, which
// opens it in the side panel.
export const runPath = (run: Pick<RunnerQueueRun, 'id' | 'projectRef'>, listPath?: string) =>
  `${listPath ?? runnerQueuePath(run.projectRef)}/${run.id}`;
