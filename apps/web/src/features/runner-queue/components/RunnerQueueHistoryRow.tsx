import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { formatDateTime } from '@/utils/dates';
import { runPlace } from '../utils/runIssueKey';
import RunnerQueueKindBadge from './RunnerQueueKindBadge';
import RunnerQueueStateIcon from './RunnerQueueStateIcon';

export default function RunnerQueueHistoryRow({
  run,
  href,
  selected,
  acrossProjects,
}: {
  run: RunnerQueueRun;
  href: string;
  selected: boolean;
  acrossProjects: boolean;
}) {
  const t = useTranslations('issue.agentRuns');
  const relativeTime = useRelativeTime();
  const place = runPlace(run, acrossProjects);
  return (
    <Link
      href={href}
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'flex w-full items-start gap-2.5 px-4 py-2 text-start hover:bg-accent/50',
        selected && 'bg-accent',
      )}
    >
      <span className="flex h-5 shrink-0 items-center">
        <RunnerQueueStateIcon run={run} className="size-3.5" />
      </span>
      <span className="sr-only">{t(run.executionState)}</span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium" dir="auto">
            {run.issueTitle ?? run.scheduleName ?? run.prompt}
          </span>
          <time
            className="ms-auto shrink-0 text-xs text-muted-foreground"
            dateTime={run.createdAt}
            title={formatDateTime(run.createdAt)}
          >
            {relativeTime(run.createdAt)}
          </time>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RunnerQueueKindBadge kind={run.kind} />
          {place}
        </span>
      </span>
    </Link>
  );
}
