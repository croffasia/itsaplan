import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { dayKey, formatShortDate, formatTime } from '@/utils/dates';
import { formatRunDuration } from '@/utils/formatRunDuration';
import { runDuration } from '../utils/runDuration';
import RunnerQueueRunElapsed from '../components/RunnerQueueRunElapsed';
import type { RunFact } from '../types/runFact';

const dateAndTime = (value: string) =>
  `${formatShortDate(value)}, ${formatTime(value, { seconds: true })}`;

// When the run was created or started and finished, how long it took, and its attempts.
// The end shows only its time when it falls on the start's day.
export function useRunTimeFacts(run: RunnerQueueRun): RunFact[] {
  const facts: RunFact[] = [];
  if (run.startedAt) facts.push(['started', dateAndTime(run.startedAt)]);
  else facts.push(['created', dateAndTime(run.createdAt)]);
  if (run.finishedAt) {
    const sameDay = run.startedAt && dayKey(run.startedAt) === dayKey(run.finishedAt);
    facts.push([
      'finished',
      sameDay ? formatTime(run.finishedAt, { seconds: true }) : dateAndTime(run.finishedAt),
    ]);
  }
  const took = runDuration(run);
  if (took != null) {
    facts.push(['duration', formatRunDuration(took)]);
  } else if (run.startedAt && run.executionState === 'running') {
    facts.push(['duration', <RunnerQueueRunElapsed key="elapsed" since={run.startedAt} />]);
  }
  if (run.attempts > 1) facts.push(['attempts', run.attempts]);
  return facts;
}
