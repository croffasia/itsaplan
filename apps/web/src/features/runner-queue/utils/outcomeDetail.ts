import type { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { formatTime } from '@/utils/dates';
import { formatRunDuration } from '@/utils/formatRunDuration';
import { runDuration } from './runDuration';

type Translate = ReturnType<typeof useTranslations<'issue.agentRuns'>>;

// How long a finished run took, or when a waiting one moves next. A run that was retried
// counts its attempts instead: its time includes the waits between them.
export function outcomeDetail(
  run: RunnerQueueRun,
  t: Translate,
  relativeTime: (value: string) => string,
): string | null {
  if (run.executionState === 'running') {
    return run.startedAt ? t('startedAgo', { time: relativeTime(run.startedAt) }) : null;
  }
  if (run.executionState === 'queued') {
    if (new Date(run.nextAttemptAt) <= new Date()) return null;
    const time = formatTime(run.nextAttemptAt);
    return run.lastError ? t('retryAt', { time }) : t('startsAt', { time });
  }
  if (run.executionState === 'canceled') return null;
  if (run.attempts > 1) return t('attemptsCount', { count: run.attempts });
  const took = runDuration(run);
  return took == null ? null : formatRunDuration(took);
}
