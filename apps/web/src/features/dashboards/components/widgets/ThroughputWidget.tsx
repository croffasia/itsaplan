import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { useTranslations } from 'next-intl';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { formatShortDate } from '@/utils/dates';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useThroughputQuery } from '../../services/analytics.service';

const SERIES_COLOR = { created: '#6366f1', closed: '#22c55e' };

// Created vs closed issues per week, as grouped bars. "Closed" is an issue entering
// the completed state it is still in; see the analytics store. The window is a
// configured setting (edited from the header settings popover, see
// ThroughputWidgetSettings), not a live control.
export default function ThroughputWidget({
  projectKey,
  config,
}: {
  projectKey: string;
  config: WidgetConfig;
}) {
  const t = useTranslations('dashboards.throughput');
  const weeks = config.weeks ?? 12;
  const { data, isLoading } = useThroughputQuery(projectKey, weeks);

  const chartConfig: ChartConfig = {
    created: { label: t('created'), color: SERIES_COLOR.created },
    closed: { label: t('closed'), color: SERIES_COLOR.closed },
  };
  const chartData = (data ?? []).map((w) => ({ ...w, label: formatShortDate(w.week) }));

  function chart() {
    if (isLoading) return <Skeleton className="h-[180px] w-full" />;
    if (chartData.length === 0) {
      return <p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>;
    }
    // Recharts draws to absolute SVG coordinates and does not read the document
    // direction, so a mirrored chart would put its axes and series out of step with
    // each other. The labels and the tooltip are still translated.
    return (
      <ChartContainer dir="ltr" config={chartConfig} className="h-[180px] w-full">
        <BarChart data={chartData}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="created" fill="var(--color-created)" radius={3} />
          <Bar dataKey="closed" fill="var(--color-closed)" radius={3} />
        </BarChart>
      </ChartContainer>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('lastWeeks', { weeks })}</p>
      {chart()}
    </div>
  );
}
