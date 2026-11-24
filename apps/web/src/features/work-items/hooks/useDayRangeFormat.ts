import { isSameDay } from 'date-fns';
import { useFormatter, useTranslations } from 'next-intl';
import { calendarSystem } from '@/utils/dates';

// The month on both ends and two-digit days keep the label's width from one week
// to the next. The year goes on both ends only when the range crosses it.
export function useDayRangeFormat() {
  const t = useTranslations('workItems.calendar');
  const format = useFormatter();
  return (from: Date, to: Date, { year }: { year: boolean }) => {
    const calendar = calendarSystem();
    const day = (date: Date, withYear: boolean) =>
      format.dateTime(date, {
        month: 'short',
        day: '2-digit',
        year: withYear ? 'numeric' : undefined,
        calendar,
      });
    if (isSameDay(from, to)) return day(to, year);
    const yearOf = (date: Date) => format.dateTime(date, { year: 'numeric', calendar });
    const crossesYear = yearOf(from) !== yearOf(to);
    return t('range', { from: day(from, year && crossesYear), to: day(to, year) });
  };
}
