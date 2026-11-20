import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';
import { formatDateTime, formatTime } from '@/utils/dates';
import { formatRunDuration } from '@/utils/formatRunDuration';
import { runDuration } from '../utils/runDuration';
import { runPlace } from '../utils/runIssueKey';
import { runTitle } from '../utils/runTitle';
import RunnerQueueStateIcon from './RunnerQueueStateIcon';

// A finished run. Inside a group its issue or schedule is named above, so the row names
// the agent instead.
export default function RunnerQueueHistoryRow({
  run,
  href,
  selected,
  acrossProjects,
  nested = false,
}: {
  run: RunnerQueueRun;
  href: string;
  selected: boolean;
  acrossProjects: boolean;
  nested?: boolean;
}) {
  const t = useTranslations('issue.agentRuns');
  const meta = (
    nested
      ? [
          `#${run.id}`,
          t(`triggers.${run.trigger}`),
          run.initiator?.name,
          run.attempts > 1 ? t('attemptsCount', { count: run.attempts }) : null,
        ]
      : [
          `@${run.username}`,
          runPlace(run, acrossProjects),
          t(`triggers.${run.trigger}`),
          run.initiator?.name,
        ]
  )
    .filter(Boolean)
    .join(' · ');
  const took = runDuration(run);
  return (
    <Link
      href={href}
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 px-4 py-2 text-start hover:bg-accent/50',
        nested && 'ps-[2.625rem]',
        selected && 'bg-accent',
      )}
    >
      <span className="flex h-5 items-center self-start">
        <RunnerQueueStateIcon run={run} className="size-3.5" />
      </span>
      <span className="truncate text-sm font-medium">
        <span className="sr-only">{t(run.executionState)} </span>
        <span dir={nested ? undefined : 'auto'}>{nested ? `@${run.username}` : runTitle(run)}</span>
      </span>
      <time
        className="text-end text-xs text-muted-foreground tabular-nums"
        dateTime={run.createdAt}
        title={formatDateTime(run.createdAt)}
      >
        {formatTime(run.createdAt)}
      </time>
      <span className="col-start-2 truncate text-xs text-muted-foreground">{meta}</span>
      <span className="text-end text-xs tabular-nums">
        {run.executionState === 'failed' ? (
          <span className="text-destructive-text">{t('failed')}</span>
        ) : (
          <span className="text-muted-foreground">{took != null && formatRunDuration(took)}</span>
        )}
      </span>
    </Link>
  );
}
