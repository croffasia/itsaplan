import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { formatDateTime } from '@/utils/dates';
import { runIssueKey } from '../utils/runIssueKey';
import RunnerQueueStateIcon from './RunnerQueueStateIcon';

export default function RunnerQueueHistoryRow({
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
  const issueKey = runIssueKey(run);
  return (
    <Link
      href={href}
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'flex h-10 w-full items-center gap-2.5 px-4 text-start hover:bg-accent/50',
        selected && 'bg-accent',
      )}
    >
      <RunnerQueueStateIcon run={run} className="size-3.5" />
      <span className="sr-only">{t(run.executionState)}</span>
      <span className="truncate text-sm font-medium" dir="auto">
        {run.issueTitle ?? run.scheduleName ?? run.prompt}
      </span>
      {issueKey && <span className="shrink-0 text-xs text-muted-foreground">{issueKey}</span>}
      <time
        className="ms-auto shrink-0 text-xs text-muted-foreground"
        dateTime={run.createdAt}
        title={formatDateTime(run.createdAt)}
      >
        {relativeTime(run.createdAt)}
      </time>
    </Link>
  );
}
