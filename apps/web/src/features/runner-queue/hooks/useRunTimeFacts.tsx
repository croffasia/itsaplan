import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { dayKey, formatShortDate, formatTime } from '@/utils/dates';
import { formatRunDuration } from '@/utils/formatRunDuration';
import { runDuration } from '../utils/runDuration';
import RunnerQueueRunElapsed from '../components/RunnerQueueRunElapsed';
import type { RunFact } from '../components/RunnerQueueRunFactList';

const dateAndTime = (value: string) =>
  `${formatShortDate(value)}, ${formatTime(value, { seconds: true })}`;

// When the run was created or started and finished, how long it took, and its attempts.
// The end shows only its time when it falls on the start's day.
export function useRunTimeFacts(run: RunnerQueueRun): RunFact[] {
  const t = useTranslations('issue.agentRuns');
  const facts: RunFact[] = [];
  if (run.startedAt) facts.push([t('facts.started'), dateAndTime(run.startedAt)]);
  else facts.push([t('facts.created'), dateAndTime(run.createdAt)]);
  if (run.finishedAt) {
    const sameDay = run.startedAt && dayKey(run.startedAt) === dayKey(run.finishedAt);
    facts.push([
      t('facts.finished'),
      sameDay ? formatTime(run.finishedAt, { seconds: true }) : dateAndTime(run.finishedAt),
    ]);
  }
  const took = runDuration(run);
  if (took != null) {
    facts.push([t('facts.duration'), formatRunDuration(took)]);
  } else if (run.startedAt && run.executionState === 'running') {
    facts.push([
      t('facts.duration'),
      <RunnerQueueRunElapsed key="elapsed" since={run.startedAt} />,
    ]);
  }
  if (run.attempts > 1) facts.push([t('facts.attempts'), run.attempts]);
  return facts;
}
