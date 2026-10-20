import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';

export function waitsForRunner(
  run: RunnerQueueRun,
): run is RunnerQueueRun & { runnerState: 'offline' | 'never' } {
  return (
    run.executionState === 'queued' &&
    (run.runnerState === 'offline' || run.runnerState === 'never')
  );
}
