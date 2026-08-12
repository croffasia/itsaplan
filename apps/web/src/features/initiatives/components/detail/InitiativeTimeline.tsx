'use client';

import { parseISO, differenceInCalendarDays } from 'date-fns';
import { useTranslations } from 'next-intl';
import type { Initiative } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import HealthBadge from '../shared/HealthBadge';
import HealthInfoPopover from '../shared/HealthInfoPopover';
import InitiativeTimelineMeter from './InitiativeTimelineMeter';

// The initiative's schedule and pace: health, start/target dates, days remaining,
// and two bars comparing elapsed time against work done. The gap between the bars
// is what the server's health signal is derived from.

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

export default function InitiativeTimeline({ initiative }: { initiative: Initiative }) {
  const t = useTranslations('initiatives.timeline');
  const { startDate, targetDate, createdAt, progress } = initiative;
  const start = startDate ?? createdAt;
  const denom = progress.total - progress.canceled;
  const work = denom > 0 ? clamp01(progress.completed / denom) : 0;

  let elapsed: number | null = null;
  let daysLeft: number | null = null;
  if (targetDate) {
    const now = new Date();
    const startMs = new Date(start).getTime();
    const targetMs = parseISO(targetDate).getTime();
    const span = targetMs - startMs;
    elapsed = span <= 0 ? 1 : clamp01((now.getTime() - startMs) / span);
    daysLeft = differenceInCalendarDays(parseISO(targetDate), now);
  }

  const remaining = (days: number) => {
    if (days < 0) return t('overdue', { days: -days });
    if (days === 0) return t('dueToday');
    return t('left', { days });
  };

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('title')}
          </h4>
          <HealthInfoPopover />
        </div>
        <HealthBadge health={initiative.health} />
      </div>

      <dl className="mb-3 flex flex-col gap-1.5 text-sm">
        {startDate && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('started')}</dt>
            <dd>{formatDate(startDate)}</dd>
          </div>
        )}
        {targetDate && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('target')}</dt>
            <dd>{formatDate(targetDate)}</dd>
          </div>
        )}
        {daysLeft != null && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('remaining')}</dt>
            <dd className={daysLeft < 0 ? 'text-destructive' : ''}>{remaining(daysLeft)}</dd>
          </div>
        )}
      </dl>

      {targetDate ? (
        <div className="flex flex-col gap-2.5">
          <InitiativeTimelineMeter label={t('timeElapsed')} pct={elapsed ?? 0} />
          <InitiativeTimelineMeter label={t('workDone')} pct={work} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('noTargetDate')}</p>
      )}
    </div>
  );
}
