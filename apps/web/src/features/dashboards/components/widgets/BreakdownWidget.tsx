import { Cell, Pie, PieChart } from 'recharts';
import { useTranslations } from 'next-intl';
import type { BreakdownBy, WidgetConfig } from '@/utils/dashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useBreakdownQuery } from '../../services/analytics.service';

// The dimensions the counts can be grouped by, in picker order. Their labels are
// messages under `dashboards.breakdown.by`.
export const BY_OPTIONS: BreakdownBy[] = ['status', 'priority', 'type', 'assignee', 'delegate'];

// Fallback slice colors for categories without their own color (priority,
// assignee). Status and type carry their entity color and use it directly.
const PALETTE = [
  '#6366f1',
  '#22c55e',
  '#eab308',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#8b5cf6',
  '#64748b',
];

// Issue counts grouped by a chosen dimension, drawn as a donut. The dimension is a
// per-widget config choice, edited from the header settings popover (see
// BreakdownWidgetSettings) and persisted on save.
export default function BreakdownWidget({
  projectKey,
  config,
}: {
  projectKey: string;
  config: WidgetConfig;
}) {
  const t = useTranslations('dashboards.breakdown');
  const by = config.by ?? 'status';
  const { data, isLoading } = useBreakdownQuery(projectKey, by);
  // An empty status bucket is still a board column, so keep it; other dimensions drop zeros.
  const items = (data ?? []).filter((i) => by === 'status' || i.count > 0);
  const total = items.reduce((sum, i) => sum + i.count, 0);
  const chartData = items.map((i, idx) => ({
    name: i.label,
    value: i.count,
    fill: i.color ?? PALETTE[idx % PALETTE.length],
  }));

  function chart() {
    if (isLoading) return <Skeleton className="mx-auto h-[160px] w-[160px] rounded-full" />;
    if (total === 0) {
      return <p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>;
    }
    return (
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <ChartContainer config={{}} className="aspect-square h-[160px]">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} strokeWidth={2}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <ul className="min-w-0 flex-1 space-y-1 text-sm">
          {chartData.map((d, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.fill }} />
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              <span className="text-muted-foreground tabular-nums">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t(`caption.${by}`)}</p>
      {chart()}
    </div>
  );
}
