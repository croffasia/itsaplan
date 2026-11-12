import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { toDateStr } from '@/utils/dates';
import type { WeekStart } from '@/utils/viewSettings';
import { CalendarWeekColumn } from './CalendarWeekColumn';

export function CalendarWeekGrid({
  project,
  days,
  weekStart,
  splitByDay,
  today,
  byDay,
  dot,
  onOpen,
  onQuickAdd,
}: {
  project: ProjectDetail;
  // Whole weeks, from a week's first day.
  days: Date[];
  weekStart: WeekStart;
  splitByDay: boolean;
  today: Date;
  byDay: Map<string, Issue[]>;
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
  onQuickAdd?: (day: string, title: string) => Promise<void>;
}) {
  const weeks = Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  return (
    <div
      className="grid min-h-0 flex-1 grid-rows-1 overflow-x-auto rounded-md border"
      style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(12rem, 1fr))` }}
    >
      {weeks.map((week) => (
        <CalendarWeekColumn
          key={toDateStr(week[0])}
          project={project}
          days={week}
          weekStart={weekStart}
          splitByDay={splitByDay}
          today={today}
          byDay={byDay}
          dot={dot}
          onOpen={onOpen}
          onQuickAdd={onQuickAdd}
        />
      ))}
    </div>
  );
}
