import { CartesianGrid, Line, LineChart, XAxis } from 'recharts';
import { useTranslations } from 'next-intl';
import type { AgentAnalytics } from '@/lib/api/endpoints/agentAnalytics';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import Panel from './Panel';
import PanelEmpty from './PanelEmpty';
import { bucketLabel, formatLatency } from '../utils/format';

const SERIES_COLOR = { p50: '#6366f1', p95: '#f59e0b' };

// How long a run took, as the median and the 95th percentile of each day. The figure
// in the header is the mean of the daily medians.
export default function Latency({ data }: { data: AgentAnalytics }) {
  const t = useTranslations('agentAnalytics');
  const chartData = data.latencyPerDay.map((day) => ({
    label: bucketLabel(data, day.day),
    p50: day.p50,
    p95: day.p95,
  }));
  const meanMedian = chartData.length
    ? chartData.reduce((sum, day) => sum + day.p50, 0) / chartData.length
    : 0;

  const config: ChartConfig = {
    p50: { label: t('latency.p50'), color: SERIES_COLOR.p50 },
    p95: { label: t('latency.p95'), color: SERIES_COLOR.p95 },
  };

  return (
    <Panel
      title={t('latency.title')}
      description={t('latency.description')}
      value={formatLatency(meanMedian)}
      valueLabel={t('latency.average')}
    >
      {chartData.length === 0 ? (
        <PanelEmpty label={t('latency.empty')} />
      ) : (
        <ChartContainer dir="ltr" config={config} className="h-[200px] w-full">
          <LineChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => formatLatency(Number(value))} />}
            />
            {(['p50', 'p95'] as const).map((key) => (
              <Line
                key={key}
                dataKey={key}
                type="monotone"
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </Panel>
  );
}
