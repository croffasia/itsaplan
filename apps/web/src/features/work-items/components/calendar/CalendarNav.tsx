import { addDays, addMonths, addWeeks } from 'date-fns';
import { ChevronLeftIcon } from '@animateicons/react/lucide/chevron-left-icon';
import { ChevronRightIcon } from '@animateicons/react/lucide/chevron-right-icon';
import { useFormatter, useTranslations } from 'next-intl';
import type { CalendarMode, WeekStart } from '@/utils/viewSettings';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ToolbarIconButton from '@/components/layout/ToolbarIconButton';
import { weekNumber } from '../../utils/calendar';
import { useDayRangeFormat } from '../../hooks/useDayRangeFormat';

// The by-week mode steps one week at a time, so any week can be the first on screen.
export function CalendarNav({
  cursor,
  mode,
  fullWeek,
  days,
  weekStart,
  onCursorChange,
}: {
  cursor: Date;
  mode: CalendarMode;
  fullWeek: boolean;
  days: Date[];
  weekStart: WeekStart;
  onCursorChange: (date: Date) => void;
}) {
  const t = useTranslations('workItems.calendar');
  const format = useFormatter();
  const dayRange = useDayRangeFormat();
  const month = mode === 'month';
  const step = (by: number) => {
    if (month) return addMonths(cursor, by);
    if (mode === 'byWeek') return addWeeks(cursor, by);
    return addDays(cursor, by * days.length);
  };
  const label = (direction: 'previous' | 'next') => {
    if (month) return t(`${direction}Month`);
    if (fullWeek) return t(`${direction}Week`);
    return t(`${direction}Days`, { count: days.length });
  };
  const previous = label('previous');
  const next = label('next');
  const title = month
    ? format.dateTime(cursor, { month: 'long', year: 'numeric', calendar: 'gregory' })
    : dayRange(days[0], days[days.length - 1], { year: true });
  return (
    <div className="flex items-center gap-2 border-b px-3 py-1.5">
      <h2 className="text-sm font-medium text-foreground tabular-nums">{title}</h2>
      {mode === 'byDay' && fullWeek && (
        <span className="text-sm text-muted-foreground">
          {t('weekNumber', { number: weekNumber(days[0], weekStart) })}
        </span>
      )}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarIconButton
              icon={ChevronLeftIcon}
              onClick={() => onCursorChange(step(-1))}
              aria-label={previous}
            />
          </TooltipTrigger>
          <TooltipContent>{previous}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarIconButton
              icon={ChevronRightIcon}
              onClick={() => onCursorChange(step(1))}
              aria-label={next}
            />
          </TooltipTrigger>
          <TooltipContent>{next}</TooltipContent>
        </Tooltip>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onCursorChange(new Date())}>
        {t('today')}
      </Button>
    </div>
  );
}
