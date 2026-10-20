import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AgentAnalytics } from '@/lib/api/endpoints/agentAnalytics';
import StatDelta, { type StatComparison } from './StatDelta';
import { formatCost, formatCount } from '../utils/format';

type Stat = StatComparison & { key: string; label: string; value: string };

// The headline figures of the window, each beside what the same span before it held.
// The cost leaves out the calls of a model no price covers, so it says how many such
// models there are, with a link to set their prices for whoever may (`pricesHref`).
export default function StatCards({
  data,
  pricesHref,
}: {
  data: AgentAnalytics;
  pricesHref?: string | null;
}) {
  const t = useTranslations('agentAnalytics');
  const { totals, previous } = data;
  // A call that names no model has no price to set, so it is not counted.
  const unpriced = data.models.filter(
    (model) => model.cost == null && model.provider && model.model,
  ).length;

  const stats: Stat[] = [
    {
      key: 'cost',
      label: t('stats.cost'),
      value: formatCost(totals.cost),
      current: totals.cost ?? 0,
      previous: previous.cost,
      previousLabel: formatCost(previous.cost),
    },
    {
      key: 'tokens',
      label: t('stats.tokens'),
      value: formatCount(totals.inputTokens + totals.outputTokens),
      current: totals.inputTokens + totals.outputTokens,
      previous: previous.inputTokens + previous.outputTokens,
    },
    {
      key: 'runs',
      label: t('stats.runs'),
      value: formatCount(totals.runs),
      current: totals.runs,
      previous: previous.runs,
    },
    {
      key: 'errors',
      label: t('stats.errors'),
      value: formatCount(totals.errors),
      current: totals.errors,
      previous: previous.errors,
      riseIsBad: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-6 xl:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.key} className="min-w-0">
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
          <StatDelta stat={stat} />
          {stat.key === 'cost' && unpriced > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <TriangleAlert className="size-3.5 shrink-0" />
              <span>
                {t('unpriced', { count: unpriced })}
                {pricesHref && (
                  <>
                    {' · '}
                    <Link href={pricesHref} className="font-medium text-foreground hover:underline">
                      {t('setPrices')}
                    </Link>
                  </>
                )}
              </span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
