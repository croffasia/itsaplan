import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts';
import { useTranslations } from 'next-intl';
import { formatDate, formatShortDate } from '@/utils/dates';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { BurnupPoint } from '../../utils/burnupSeries';

const TODAY_COLOR = '#94a3b8';
const TARGET_COLOR = '#ef4444';

// The legend in reading order (outer line to inner), not the alphabetical default.
const LEGEND_ORDER = ['scope', 'started', 'completed', 'projection', 'band'];
const legendOrder = (item: { dataKey?: unknown }) => LEGEND_ORDER.indexOf(String(item.dataKey));

// A tooltip value: a count, or the band's [slow, fast] pair as "168 – 256" (the
// default would print the array as "168,256", which reads as a decimal in many
// locales). Both edges start at today's count, so an equal pair is one number.
function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    const [slow, fast] = value as [number, number];
    return slow === fast
      ? fast.toLocaleString()
      : `${slow.toLocaleString()} – ${fast.toLocaleString()}`;
  }
  return typeof value === 'number' ? value.toLocaleString() : String(value);
}

// The burnup chart itself: scope and completed as areas, started as a line, the
// projection and the growing scope as dashed lines into the future and, in range
// mode, a band between the optimistic and the pessimistic date. A "today" marker separates the
// history from the projection whenever there is one, and the initiative's target
// date is marked when it falls on the axis.
export default function BurnupChart({
  points,
  config,
  today,
  target,
}: {
  points: BurnupPoint[];
  config: ChartConfig;
  today: string;
  target: string | null;
}) {
  const t = useTranslations('dashboards.burnup');
  const hasFuture = points.at(-1)?.date !== today;
  const showTarget = target != null && points.some((p) => p.date === target);
  // Recharts draws to absolute SVG coordinates and does not read the document
  // direction, so a mirrored chart would put its axes and series out of step with
  // each other. The labels and the tooltip are still translated.
  return (
    <ChartContainer dir="ltr" config={config} className="h-full min-h-[180px] w-full">
      <ComposedChart data={points}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          minTickGap={40}
          tickFormatter={formatShortDate}
        />
        <YAxis width={30} tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatDate(String(value))}
              formatter={(value, name, item) => (
                <>
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex flex-1 items-center justify-between gap-3 leading-none">
                    <span className="text-muted-foreground">
                      {config[String(name)]?.label ?? String(name)}
                    </span>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {formatValue(value)}
                    </span>
                  </div>
                </>
              )}
            />
          }
        />
        <ChartLegend
          content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />}
          itemSorter={legendOrder}
        />
        <Area
          type="monotone"
          dataKey="scope"
          stroke="var(--color-scope)"
          fill="var(--color-scope)"
          fillOpacity={0.12}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="started"
          stroke="var(--color-started)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="completed"
          stroke="var(--color-completed)"
          strokeWidth={1.5}
          fill="var(--color-completed)"
          fillOpacity={0.2}
          dot={false}
          isAnimationActive={false}
        />
        <Area
          dataKey="band"
          stroke="var(--color-band)"
          strokeWidth={1}
          strokeDasharray="2 3"
          fill="var(--color-band)"
          fillOpacity={0.12}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          dataKey="scopeProjection"
          stroke="var(--color-scope)"
          strokeWidth={1}
          strokeDasharray="4 4"
          dot={false}
          connectNulls
          legendType="none"
          isAnimationActive={false}
        />
        <Line
          dataKey="projection"
          stroke="var(--color-projection)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        {hasFuture && (
          <ReferenceLine
            x={today}
            stroke={TODAY_COLOR}
            strokeDasharray="2 2"
            label={{
              value: t('today'),
              position: 'insideTopRight',
              fontSize: 10,
              fill: TODAY_COLOR,
            }}
          />
        )}
        {showTarget && (
          <ReferenceLine
            x={target}
            stroke={TARGET_COLOR}
            strokeDasharray="2 2"
            label={{
              value: t('targetLabel'),
              position: 'insideTopLeft',
              fontSize: 10,
              fill: TARGET_COLOR,
            }}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
}
