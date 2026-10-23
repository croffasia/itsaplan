import Link from 'next/link';
import { ArrowUpRight, Ban, Check, Clock, LoaderCircle, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { formatTime } from '@/utils/dates';
import { issuePath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { formatRunDuration } from '../utils/formatRunDuration';
import { runIssueKey } from '../utils/runIssueKey';
import { waitsForRunner } from '../utils/waitsForRunner';

type Translate = ReturnType<typeof useTranslations<'issue.agentRuns'>>;

const OUTCOME = {
  success: [Check, 'bg-muted'],
  failed: [X, 'bg-destructive/15 text-destructive'],
  running: [LoaderCircle, 'bg-muted [&>svg]:animate-spin'],
  queued: [Clock, 'bg-warning/15 text-warning'],
  canceled: [Ban, 'bg-muted text-muted-foreground'],
} as const;

// How long a finished run took, or when a waiting one moves next. A run that was retried
// counts its attempts instead: its time includes the waits between them.
function outcomeDetail(
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
  if (run.attempts > 1) return t('afterAttempts', { count: run.attempts });
  if (!run.startedAt || !run.finishedAt) return null;
  const took = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  return t('inDuration', { duration: formatRunDuration(took) });
}

export default function RunnerQueueRunHeader({ run }: { run: RunnerQueueRun }) {
  const t = useTranslations('issue.agentRuns');
  const relativeTime = useRelativeTime();
  const [StateIcon, tone] = OUTCOME[run.executionState];
  const Icon = run.executionState === 'queued' && run.runnerState === 'push' ? Send : StateIcon;
  const detail = outcomeDetail(run, t, relativeTime);
  const issueKey = runIssueKey(run);
  const href = run.sequenceNumber == null ? null : issuePath(run.projectRef, run.sequenceNumber);
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <span
          className={cn('flex size-12 shrink-0 items-center justify-center rounded-full', tone)}
        >
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">
            {waitsForRunner(run) ? t('waitingForRunner') : t(run.executionState)}
            {detail && <span className="font-normal text-muted-foreground"> {detail}</span>}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {href ? (
              <Link
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:underline"
                dir="auto"
              >
                {issueKey} {run.issueTitle}
              </Link>
            ) : (
              run.scheduleName && t('scheduleRun', { name: run.scheduleName })
            )}
            {(href || run.scheduleName) && ' · '}
            {run.projectRef}
          </p>
        </div>
      </div>
      {href && (
        <Button asChild variant="secondary" size="sm">
          <Link href={href} target="_blank" rel="noopener noreferrer">
            {t('openWorkItem')}
            <ArrowUpRight />
          </Link>
        </Button>
      )}
    </header>
  );
}
