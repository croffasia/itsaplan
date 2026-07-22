import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
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

const CHART_CONFIG: ChartConfig = {
  created: { label: 'Created', color: '#6366f1' },
  closed: { label: 'Closed', color: '#22c55e' },
};

// Created vs closed issues per week, as grouped bars. "Closed" is a status change
// into a completed column (from the activity log); see the analytics store. The
// window is a configured setting (edited from the header settings popover, see
// ThroughputWidgetSettings), not a live control.
export default function ThroughputWidget({
  projectKey,
  config,
}: {
  projectKey: string;
  config: WidgetConfig;
}) {
  const weeks = config.weeks ?? 12;
  const { data, isLoading } = useThroughputQuery(projectKey, weeks);

  const chartData = (data ?? []).map((w) => ({ ...w, label: format(parseISO(w.week), 'MMM d') }));

  function chart() {
    if (isLoading) return <Skeleton className="h-[180px] w-full" />;
    if (chartData.length === 0) {
      return (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No activity in this period.
        </p>
      );
    }
    return (
      <ChartContainer config={CHART_CONFIG} className="h-[180px] w-full">
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
      <p className="text-xs text-muted-foreground">Last {weeks} weeks</p>
      {chart()}
    </div>
  );
}
