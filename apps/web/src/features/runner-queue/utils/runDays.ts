import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { dayKey } from '@/utils/dates';

// Runs split by the day they were queued on in the user's zone, newest day first as the
// list already is.
export function runDays(runs: RunnerQueueRun[]): { day: string; runs: RunnerQueueRun[] }[] {
  const days: { day: string; runs: RunnerQueueRun[] }[] = [];
  for (const run of runs) {
    const day = dayKey(run.createdAt);
    const last = days.at(-1);
    if (last?.day === day) last.runs.push(run);
    else days.push({ day, runs: [run] });
  }
  return days;
}
