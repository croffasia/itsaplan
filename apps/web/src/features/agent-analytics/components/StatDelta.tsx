import { TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { changeRatio, formatCount, formatPercent } from '../utils/format';

// How far one headline figure moved from the same span before it. A previous period
// of zero has no ratio, and a figure that is not of the window carries no previous
// value at all; both read as having nothing to compare against.
export interface StatComparison {
  current: number;
  previous: number | null;
  // What to print for the previous value when it is not a plain count.
  previousLabel?: string;
  // Whether a rise is bad. Only the error count is coloured against its direction: a
  // period that cost less than the one before it is not a decline.
  riseIsBad?: boolean;
}

export default function StatDelta({ stat }: { stat: StatComparison }) {
  const t = useTranslations('agentAnalytics');
  const ratio = stat.previous == null ? null : changeRatio(stat.current, stat.previous);
  if (ratio == null) {
    return <p className="mt-1 text-xs text-muted-foreground">{t('noComparison')}</p>;
  }
  const Icon = ratio >= 0 ? TrendingUp : TrendingDown;
  const tone = stat.riseIsBad
    ? ratio > 0
      ? 'text-destructive'
      : 'text-emerald-600 dark:text-emerald-500'
    : 'text-muted-foreground';
  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn('flex items-center gap-1 font-medium', tone)}>
        <Icon className="size-3.5" />
        {formatPercent(ratio)}
      </span>
      {t('vsPrevious', { value: stat.previousLabel ?? formatCount(stat.previous ?? 0) })}
    </p>
  );
}
