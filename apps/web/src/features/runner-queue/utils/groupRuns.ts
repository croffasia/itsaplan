import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';

// What runs share to fall in one group: their issue, or else their schedule.
const groupKey = (run: RunnerQueueRun) =>
  run.issueId != null
    ? `issue:${run.issueId}`
    : run.scheduleId != null && `schedule:${run.scheduleId}`;

// Consecutive runs on one issue or of one schedule, so the list names it once and the
// runs below it.
export function groupRuns(runs: RunnerQueueRun[]): RunnerQueueRun[][] {
  const groups: RunnerQueueRun[][] = [];
  for (const run of runs) {
    const last = groups.at(-1);
    const key = groupKey(run);
    if (last && key && groupKey(last[0]) === key) last.push(run);
    else groups.push([run]);
  }
  return groups;
}
