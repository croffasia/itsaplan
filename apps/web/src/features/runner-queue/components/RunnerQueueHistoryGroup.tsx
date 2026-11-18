import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/dates';
import { runIssueKey } from '../utils/runIssueKey';
import { runTitle } from '../utils/runTitle';
import RunnerQueueHistoryRow from './RunnerQueueHistoryRow';

const DOT = {
  success: 'bg-green-500',
  failed: 'bg-destructive',
  running: 'bg-foreground',
  queued: 'bg-warning',
  canceled: 'bg-muted-foreground',
} as const;

// Consecutive runs on one issue or of one schedule under its name, with a dot per run for
// how it ended and the time they span. The group is open while it holds the selected
// run, until the reader toggles it.
export default function RunnerQueueHistoryGroup({
  runs,
  path,
  selectedId,
  acrossProjects,
}: {
  runs: RunnerQueueRun[];
  path: string;
  selectedId: number | null;
  acrossProjects: boolean;
}) {
  const t = useTranslations('issue.agentRuns');
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? runs.some((run) => run.id === selectedId);
  const issueKey = runIssueKey(runs[0]);
  const first = formatTime(runs.at(-1)!.createdAt);
  const last = formatTime(runs[0].createdAt);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setToggled(!open)}
        className="grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 px-4 py-2 text-start hover:bg-accent/50"
      >
        <span className="flex h-5 items-center self-start">
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3.5 text-muted-foreground transition-transform duration-150',
              open ? 'rotate-90' : 'rtl:rotate-180',
            )}
          />
        </span>
        <span className="truncate text-sm font-medium" dir="auto">
          {runTitle(runs[0])}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('runsCount', { count: runs.length })}
        </span>
        <span className="col-span-2 col-start-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {issueKey && <span className="shrink-0">{issueKey} ·</span>}
          <span aria-hidden className="flex min-w-0 gap-[3px] overflow-hidden">
            {runs.map((run) => (
              <i
                key={run.id}
                className={cn('size-1.5 shrink-0 rounded-full', DOT[run.executionState])}
              />
            ))}
          </span>
          <span className="shrink-0 tabular-nums">
            · {first === last ? last : `${first}–${last}`}
          </span>
        </span>
      </button>
      {open &&
        runs.map((run) => (
          <RunnerQueueHistoryRow
            key={run.id}
            run={run}
            href={`${path}/${run.id}`}
            selected={run.id === selectedId}
            acrossProjects={acrossProjects}
            nested
          />
        ))}
    </div>
  );
}
