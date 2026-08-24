import { useTranslations } from 'next-intl';
import { formatMinutes } from '@/utils/estimate';
import { cn } from '@/lib/utils';

// The time logged on the issue read against its estimate: a bar of how much of the
// estimate went in, the time itself, and what is left of it. An issue with no
// estimate has nothing to fill, so the bar reads full and only names the time.
export default function IssueTimeTracking({
  logged,
  estimate,
}: {
  logged: number;
  estimate: number | null;
}) {
  const t = useTranslations('issue.fields');
  const over = estimate != null && logged > estimate;
  const filled = estimate == null || estimate === 0 ? 1 : Math.min(1, logged / estimate);

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', over ? 'bg-destructive' : 'bg-foreground/70')}
          style={{ width: `${filled * 100}%` }}
        />
      </div>
      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{t('timeLoggedValue', { time: formatMinutes(logged) })}</span>
        {estimate != null && (
          <span className={cn('truncate', over && 'text-destructive')}>
            {over
              ? t('timeOverBy', { time: formatMinutes(logged - estimate) })
              : t('timeRemainingValue', { time: formatMinutes(estimate - logged) })}
          </span>
        )}
      </div>
    </div>
  );
}
