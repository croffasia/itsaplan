import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';

// How long a run took from its first start to its end, waits between attempts included;
// null until it has both.
export function runDuration(run: Pick<RunnerQueueRun, 'startedAt' | 'finishedAt'>) {
  if (!run.startedAt || !run.finishedAt) return null;
  return Date.parse(run.finishedAt) - Date.parse(run.startedAt);
}
