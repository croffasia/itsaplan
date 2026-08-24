import { useTranslations } from 'next-intl';
import type { Cycle } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';

// The days a cycle ran. One that was finished before its planned end date ended on
// the day it was finished, so the range shows that day and names the planned one.
export default function CycleRange({ cycle }: { cycle: Cycle }) {
  const t = useTranslations('cycles');

  return (
    <>
      {formatShortDate(cycle.startDate)} – {formatShortDate(cycle.completedAt ?? cycle.endDate)}
      {cycle.completedAt && ` · ${t('finishedEarly', { date: formatShortDate(cycle.endDate) })}`}
    </>
  );
}
