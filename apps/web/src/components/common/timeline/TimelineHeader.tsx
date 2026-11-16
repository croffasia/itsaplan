import { type ReactNode } from 'react';
import { startOfDay } from 'date-fns';
import { calendarSystem, dayOfMonth, daysBetween, localeWeekStart } from '@/utils/dates';
import { type MonthLabel } from '@/utils/timelineTrack';
import { cn } from '@/lib/utils';

// The sticky timeline header: the label column's corner, month labels, and the
// day-number row. Day numbers thin out as the day width shrinks.
export function TimelineHeader({
  labelW,
  trackWidth,
  dayW,
  months,
  days,
  corner,
}: {
  labelW: number;
  trackWidth: number;
  dayW: number;
  months: MonthLabel[];
  days: Date[];
  // What the corner over the label column shows; empty when absent.
  corner?: ReactNode;
}) {
  const today = startOfDay(new Date());
  // The Iranian weekend is Friday.
  const persian = calendarSystem() === 'persian';
  const weekStart = localeWeekStart();
  return (
    <div className="sticky top-0 z-20 flex border-b bg-background">
      <div className="sticky left-0 z-10 shrink-0 border-r bg-background" style={{ width: labelW }}>
        {corner}
      </div>
      <div className="relative" style={{ width: trackWidth, height: 44 }}>
        <div className="relative h-5 border-b">
          {months.map((m) => (
            <div
              key={m.left}
              className="absolute top-0 truncate px-1.5 text-[11px] leading-5 font-medium text-muted-foreground"
              style={{ left: m.left, width: m.width }}
            >
              {m.label}
            </div>
          ))}
        </div>
        <div className="flex h-6">
          {days.map((d, i) => {
            const weekday = d.getDay();
            const weekend = persian ? weekday === 5 : weekday === 0 || weekday === 6;
            const isToday = daysBetween(today, d) === 0;
            // Every day when wide (week); only the first day of each week when medium
            // (month); none when narrow (quarter) — the month labels above carry it.
            const showNum = dayW >= 20 || (dayW >= 8 && weekday === weekStart);
            return (
              <div
                key={i}
                className={cn(
                  'flex shrink-0 items-center justify-center text-[10px]',
                  weekend ? 'text-muted-foreground/50' : 'text-muted-foreground',
                  isToday && 'font-semibold text-primary',
                )}
                style={{ width: dayW }}
              >
                {showNum ? dayOfMonth(d) : ''}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
