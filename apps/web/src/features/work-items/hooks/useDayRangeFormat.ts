import { isSameDay } from 'date-fns';
import { useFormatter, useTranslations } from 'next-intl';

// The month on both ends and two-digit days keep the label's width from one week
// to the next. The year goes on both ends only when the range crosses it.
export function useDayRangeFormat() {
  const t = useTranslations('workItems.calendar');
  const format = useFormatter();
  return (from: Date, to: Date, { year }: { year: boolean }) => {
    const day = (date: Date, withYear: boolean) =>
      format.dateTime(date, {
        month: 'short',
        day: '2-digit',
        year: withYear ? 'numeric' : undefined,
        calendar: 'gregory',
      });
    if (isSameDay(from, to)) return day(to, year);
    const crossesYear = from.getFullYear() !== to.getFullYear();
    return t('range', { from: day(from, year && crossesYear), to: day(to, year) });
  };
}
