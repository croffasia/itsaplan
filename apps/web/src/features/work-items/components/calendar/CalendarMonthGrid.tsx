import { isSameDay, isSameMonth } from 'date-fns';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { toDateStr } from '@/utils/dates';
import { CalendarDayCell } from './CalendarDayCell';

export function CalendarMonthGrid({
  project,
  cursor,
  today,
  days,
  weekdayNames,
  byDay,
  dot,
  onOpen,
  onQuickAdd,
}: {
  project: ProjectDetail;
  cursor: Date;
  today: Date;
  days: Date[];
  // The seven weekday names, Sunday first.
  weekdayNames: string[];
  byDay: Map<string, Issue[]>;
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
  onQuickAdd?: (day: string, title: string) => Promise<void>;
}) {
  return (
    <>
      <div className="grid grid-cols-7 border-b py-1.5 text-xs font-medium text-muted-foreground">
        {days.slice(0, 7).map((day) => (
          <div key={day.getDay()} className="truncate px-0.5 text-center sm:px-2 sm:text-start">
            {weekdayNames[day.getDay()]}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-6 overflow-hidden">
        {days.map((day) => {
          const key = toDateStr(day);
          return (
            <CalendarDayCell
              key={key}
              project={project}
              dateKey={key}
              dayNumber={day.getDate()}
              inMonth={isSameMonth(day, cursor)}
              isToday={isSameDay(day, today)}
              issues={byDay.get(key) ?? []}
              dot={dot}
              onOpen={onOpen}
              onQuickAdd={onQuickAdd}
            />
          );
        })}
      </div>
    </>
  );
}
