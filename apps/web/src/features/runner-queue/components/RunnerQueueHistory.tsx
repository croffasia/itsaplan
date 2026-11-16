import { useTranslations } from 'next-intl';
import type { RunnerQueueRun } from '@/lib/api/endpoints/runnerQueue';
import { dayKey, formatShortDate } from '@/utils/dates';
import { groupRuns } from '../utils/groupRuns';
import { runDays } from '../utils/runDays';
import RunnerQueueHistoryGroup from './RunnerQueueHistoryGroup';
import RunnerQueueHistoryRow from './RunnerQueueHistoryRow';

const DAY_MS = 24 * 60 * 60 * 1000;

// Finished runs by day, with consecutive runs on one issue or schedule folded into a group.
export default function RunnerQueueHistory({
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
  const now = Date.now();
  const today = dayKey(new Date(now).toISOString());
  const yesterday = dayKey(new Date(now - DAY_MS).toISOString());

  function dayLabel(day: string) {
    if (day === today) return t('today');
    if (day === yesterday) return t('yesterday');
    return formatShortDate(day);
  }

  return runDays(runs).map(({ day, runs: dayRuns }) => (
    <section key={day}>
      <h2 className="px-4 pt-4 pb-1 text-xs font-semibold text-muted-foreground">
        {dayLabel(day)}
      </h2>
      {groupRuns(dayRuns).map((group) =>
        group.length === 1 ? (
          <RunnerQueueHistoryRow
            key={group[0].id}
            run={group[0]}
            href={`${path}/${group[0].id}`}
            selected={group[0].id === selectedId}
            acrossProjects={acrossProjects}
          />
        ) : (
          // Keyed by its oldest run, so a new run on the issue keeps the group's state.
          <RunnerQueueHistoryGroup
            key={group.at(-1)!.id}
            runs={group}
            path={path}
            selectedId={selectedId}
            acrossProjects={acrossProjects}
          />
        ),
      )}
    </section>
  ));
}
