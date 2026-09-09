import { useState } from 'react';
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
import MeasureTabs, { type Measure } from './MeasureTabs';
import { bucketLabel, formatCost, formatCount } from '../utils/format';

const SERIES_COLOR = { input: '#6366f1', output: '#f59e0b' };

// Input and output tokens per day, or what each day cost.
export default function TokensOverTime({ data }: { data: AgentAnalytics }) {
  const t = useTranslations('agentAnalytics');
  const [measure, setMeasure] = useState<Measure>('tokens');
  const tokens = data.totals.inputTokens + data.totals.outputTokens;

  const chartData = data.tokensPerDay.map((day) => ({
    label: bucketLabel(data, day.day),
    input: day.inputTokens,
    output: day.outputTokens,
    cost: day.cost ?? 0,
  }));

  const config: ChartConfig =
    measure === 'tokens'
      ? {
          input: { label: t('series.input'), color: SERIES_COLOR.input },
          output: { label: t('series.output'), color: SERIES_COLOR.output },
        }
      : { cost: { label: t('measure.cost'), color: SERIES_COLOR.input } };
  const keys = measure === 'tokens' ? (['input', 'output'] as const) : (['cost'] as const);

  return (
    <Panel
      title={t('overTime.title')}
      description={t('overTime.description')}
      value={measure === 'tokens' ? formatCount(tokens) : formatCost(data.totals.cost)}
      valueLabel={measure === 'tokens' ? t('byAgent.totalTokens') : t('models.totalCost')}
    >
      <div className="space-y-3">
        <MeasureTabs value={measure} onChange={setMeasure} />
        {chartData.length === 0 ? (
          <PanelEmpty label={t('overTime.empty')} />
        ) : (
          // Recharts draws to absolute SVG coordinates and does not read the document
          // direction, so a mirrored chart would put its axes and series out of step.
          <ChartContainer dir="ltr" config={config} className="h-[200px] w-full">
            <LineChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              {keys.map((key) => (
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
      </div>
    </Panel>
  );
}
