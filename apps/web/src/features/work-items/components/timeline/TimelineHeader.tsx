import { startOfDay } from 'date-fns';
import { daysBetween } from '@/utils/dates';
import { cn } from '@/lib/utils';
import { type MonthLabel } from '../../utils/timeline';

// The sticky timeline header: an empty corner over the label column, month labels,
// and the day-number row. Day numbers thin out as the day width shrinks.
export function TimelineHeader({
  labelW,
  trackWidth,
  dayW,
  months,
  days,
}: {
  labelW: number;
  trackWidth: number;
  dayW: number;
  months: MonthLabel[];
  days: Date[];
}) {
  const today = startOfDay(new Date());
  return (
    <div className="sticky top-0 z-20 flex border-b bg-background">
      <div
        className="sticky left-0 z-10 shrink-0 border-r bg-background"
        style={{ width: labelW }}
      />
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
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            const isToday = daysBetween(today, d) === 0;
            // Every day when wide (week); only Mondays when medium (month); none
            // when narrow (quarter) — the month labels above carry it.
            const showNum = dayW >= 20 || (dayW >= 8 && d.getDay() === 1);
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
                {showNum ? d.getDate() : ''}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
