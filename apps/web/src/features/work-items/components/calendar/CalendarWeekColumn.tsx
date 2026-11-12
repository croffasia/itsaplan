import { isSameDay } from 'date-fns';
import { useFormatter, useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { cn } from '@/lib/utils';
import { toDateStr } from '@/utils/dates';
import type { WeekStart } from '@/utils/viewSettings';
import { weekNumber } from '../../utils/calendar';
import { useDayRangeFormat } from '../../hooks/useDayRangeFormat';
import { CalendarWeekDay } from './CalendarWeekDay';
import { CalendarWeekList } from './CalendarWeekList';
import { CalendarQuickAdd } from './CalendarQuickAdd';

export function CalendarWeekColumn({
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
  days: Date[];
  weekStart: WeekStart;
  splitByDay: boolean;
  today: Date;
  byDay: Map<string, Issue[]>;
  dot: (issue: Issue) => string;
  onOpen: (id: number) => void;
  onQuickAdd?: (day: string, title: string) => Promise<void>;
}) {
  const t = useTranslations('workItems.calendar');
  const format = useFormatter();
  const dayRange = useDayRangeFormat();
  const dayLabel = (day: Date) =>
    format.dateTime(day, { weekday: 'short', day: 'numeric', calendar: 'gregory' });
  const issuesOf = (day: Date) => byDay.get(toDateStr(day)) ?? [];
  const todayInWeek = days.find((day) => isSameDay(day, today));
  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-col border-s first:border-s-0',
        !splitByDay && 'group/add',
      )}
    >
      <div className="flex flex-col items-start gap-1 border-b px-3 py-2">
        <span
          className={cn(
            '-ms-1.5 rounded px-1.5 text-xs text-muted-foreground',
            todayInWeek && 'bg-primary font-medium text-primary-foreground',
          )}
        >
          {t('weekNumber', { number: weekNumber(days[0], weekStart) })}
        </span>
        <span className="text-lg leading-7 font-medium text-foreground tabular-nums">
          {dayRange(days[0], days[6], { year: false })}
        </span>
      </div>
      {splitByDay ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {days.map((day) => (
            <CalendarWeekDay
              key={toDateStr(day)}
              project={project}
              dateKey={toDateStr(day)}
              label={dayLabel(day)}
              isToday={isSameDay(day, today)}
              issues={issuesOf(day)}
              dot={dot}
              onOpen={onOpen}
              onQuickAdd={onQuickAdd}
            />
          ))}
        </div>
      ) : (
        <>
          <CalendarWeekList
            project={project}
            firstDay={toDateStr(days[0])}
            entries={days.flatMap((day) =>
              issuesOf(day).map((issue) => ({ issue, dayLabel: dayLabel(day) })),
            )}
            dot={dot}
            onOpen={onOpen}
          />
          {onQuickAdd && (
            <div className="px-1.5 pb-1.5">
              <CalendarQuickAdd
                onAdd={(title) => onQuickAdd(toDateStr(todayInWeek ?? days[0]), title)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
