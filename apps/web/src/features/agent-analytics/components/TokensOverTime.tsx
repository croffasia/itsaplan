import { useId, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { useTranslations } from 'next-intl';
import type { AgentAnalytics } from '@/lib/api/endpoints/agentAnalytics';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import AreaGradient from '@/components/common/chart/AreaGradient';
import Panel from './Panel';
import PanelEmpty from './PanelEmpty';
import MeasureTabs, { type Measure } from './MeasureTabs';
import { bucketLabel, formatCost, formatCount } from '../utils/format';

const SERIES_COLOR = { input: 'var(--chart-1)', output: 'var(--chart-2)' };

// Input and output tokens per day, or what each day cost.
export default function TokensOverTime({ data }: { data: AgentAnalytics }) {
  const t = useTranslations('agentAnalytics');
  const [measure, setMeasure] = useState<Measure>('tokens');
  const gradientId = `tokens-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
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
      valueLabel={measure === 'tokens' ? t('totalTokens') : t('totalCost')}
    >
      <div className="space-y-3">
        <MeasureTabs value={measure} onChange={setMeasure} />
        {chartData.length === 0 ? (
          <PanelEmpty label={t('overTime.empty')} />
        ) : (
          // Recharts draws to absolute SVG coordinates and does not read the document
          // direction, so a mirrored chart would put its axes and series out of step.
          <ChartContainer dir="ltr" config={config} className="h-[200px] w-full">
            <AreaChart data={chartData}>
              <defs>
                {keys.map((key) => (
                  <AreaGradient
                    key={key}
                    id={`${gradientId}-${key}`}
                    color={`var(--color-${key})`}
                  />
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      measure === 'tokens' ? formatCount(Number(value)) : formatCost(Number(value))
                    }
                  />
                }
              />
              {keys.map((key) => (
                <Area
                  key={key}
                  dataKey={key}
                  type="monotone"
                  stroke={`var(--color-${key})`}
                  strokeWidth={2}
                  fill={`url(#${gradientId}-${key})`}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </Panel>
  );
}
