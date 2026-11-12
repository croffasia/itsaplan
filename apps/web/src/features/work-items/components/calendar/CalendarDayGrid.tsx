import { isSameDay } from 'date-fns';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { toDateStr } from '@/utils/dates';
import { CalendarDayColumn } from './CalendarDayColumn';

export function CalendarDayGrid({
  project,
  days,
  today,
  weekdayNames,
  byDay,
  dot,
  onOpen,
  onQuickAdd,
}: {
  project: ProjectDetail;
  days: Date[];
  today: Date;
  // Sunday first.
  weekdayNames: string[];
  byDay: Map<string, Issue[]>;
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
  onQuickAdd?: (day: string, title: string) => Promise<void>;
}) {
  return (
    <div
      className="grid min-h-0 flex-1 grid-rows-1 overflow-x-auto rounded-md border"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(7rem, 1fr))` }}
    >
      {days.map((day) => {
        const key = toDateStr(day);
        return (
          <CalendarDayColumn
            key={key}
            project={project}
            dateKey={key}
            weekday={weekdayNames[day.getDay()]}
            dayNumber={day.getDate()}
            isToday={isSameDay(day, today)}
            issues={byDay.get(key) ?? []}
            dot={dot}
            onOpen={onOpen}
            onQuickAdd={onQuickAdd}
          />
        );
      })}
    </div>
  );
}
