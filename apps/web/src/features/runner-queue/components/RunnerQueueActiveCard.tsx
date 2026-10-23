import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { formatTime } from '@/utils/dates';
import { runIssueKey } from '../utils/runIssueKey';
import { waitsForRunner } from '../utils/waitsForRunner';
import RunnerQueueStateIcon from './RunnerQueueStateIcon';

type Translate = ReturnType<typeof useTranslations<'issue.agentRuns'>>;

// What the run waits on, and when that changes. A push agent's presence is unknown, so
// only the endpoint's last refusal is shown for it.
function runStatus(
  run: RunnerQueueRun,
  t: Translate,
  relativeTime: (value: string) => string,
): [label: string, aside: string | null] {
  if (run.executionState === 'running') {
    return [t('running'), relativeTime(run.startedAt ?? run.createdAt)];
  }
  const due = new Date(run.nextAttemptAt) > new Date();
  const time = formatTime(run.nextAttemptAt);
  if (run.lastError) return [run.lastError, due ? t('retryAt', { time }) : null];
  if (waitsForRunner(run)) return [t('waitingForRunner'), relativeTime(run.createdAt)];
  return [t('queued'), due ? t('startsAt', { time }) : relativeTime(run.createdAt)];
}

export default function RunnerQueueActiveCard({
  run,
  href,
  selected,
}: {
  run: RunnerQueueRun;
  href: string;
  selected: boolean;
}) {
  const t = useTranslations('issue.agentRuns');
  const relativeTime = useRelativeTime();
  const [label, aside] = runStatus(run, t, relativeTime);
  const meta = [
    runIssueKey(run),
    `@${run.username}`,
    t(`triggers.${run.trigger}`),
    run.attempts > 1 ? t('attempts', { count: run.attempts }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Link
      href={href}
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'flex w-full flex-col gap-1.5 rounded-lg border bg-card p-3 text-start hover:bg-accent/50',
        selected && 'bg-accent',
      )}
    >
      <span
        className={cn(
          'flex w-full items-center gap-1.5 text-xs font-medium',
          run.executionState === 'queued' && 'text-warning',
        )}
      >
        <RunnerQueueStateIcon run={run} className="size-3.5" />
        <span className="truncate">{label}</span>
        {aside && (
          <span className="ms-auto shrink-0 font-normal text-muted-foreground">{aside}</span>
        )}
      </span>
      <span className="line-clamp-2 text-sm font-medium" dir="auto">
        {run.issueTitle ?? run.scheduleName ?? run.prompt}
      </span>
      <span className="text-xs text-muted-foreground">{meta}</span>
    </Link>
  );
}
