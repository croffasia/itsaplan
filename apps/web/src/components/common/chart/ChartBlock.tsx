'use client';

import { memo, useRef } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  Scatter,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts';
import {
  chartHasLegend,
  chartLegend,
  seriesColor,
  type ChartLegendEntry,
  type ChartSeries,
  type ChartSpec,
} from '@/utils/chartSpec';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import ChartDownload from './ChartDownload';

// Draws a chart spec — what an agent gets back from the create_chart tool, drawn where
// the ```chart fence carrying it sits in the answer.
//
// Colors are passed to each mark directly rather than through the chart config,
// because a series key is written by a model and would otherwise end up in a
// `--color-<key>` CSS variable name. What the config holds is the labels: the shadcn
// tooltip and legend print the entry they find in it and nothing when they find none,
// so it is keyed the way they look an entry up — by category for a pie and a radial,
// by series for the rest (see chartLegend).
function ChartBlock({ spec }: { spec: ChartSpec; source: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const legend = chartLegend(spec);
  const config: ChartConfig = Object.fromEntries(
    legend.map((entry) => [entry.key, { label: entry.label }]),
  );

  return (
    // `min-w-64` gives the figure an intrinsic width: the chart container is sized in
    // percentages, so it contributes nothing to the fit-content width of the chat
    // bubble around it and a chart-only answer would collapse to the header row.
    <figure className="my-3 w-full min-w-64">
      <div className="mb-2 flex items-center gap-2">
        {spec.title && (
          <figcaption className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {spec.title}
          </figcaption>
        )}
        <ChartDownload chartRef={chartRef} spec={spec} />
      </div>
      {/* Recharts draws to absolute SVG coordinates and does not read the document
          direction, so a mirrored chart would put its axes and series out of step
          with each other. The labels and the tooltip still follow the text. */}
      {/* The treemap draws its own labels over the filled rectangles, and recharts
          leaves them the default black; the rule reaches those nodes only. */}
      <ChartContainer
        ref={chartRef}
        dir="ltr"
        config={config}
        className="h-[220px] w-full [&_[class*='recharts-treemap-depth']_text]:fill-white"
      >
        {chart(spec, legend)}
      </ChartContainer>
    </figure>
  );
}

// The answer is re-split into segments on every streamed token, so the spec is a new
// object each time it is read out of the fence. Comparing the fence text it came from
// is what stops a finished chart from redrawing for the rest of the message.
export default memo(ChartBlock, (previous, next) => previous.source === next.source);

function chart(spec: ChartSpec, legend: ChartLegendEntry[]) {
  switch (spec.type) {
    case 'pie':
      return pie(spec, legend);
    case 'radial':
      return radial(spec, legend);
    case 'radar':
      return radar(spec);
    case 'funnel':
      return funnel(spec, legend);
    case 'treemap':
      return treemap(spec, legend);
    default:
      return cartesian(spec);
  }
}

function legendOf(spec: ChartSpec, nameKey?: string) {
  if (!chartHasLegend(spec)) return null;
  return <ChartLegend content={<ChartLegendContent nameKey={nameKey} />} />;
}

function valueLabels(spec: ChartSpec, position: 'top' | 'right' | 'insideStart') {
  if (!spec.showValues) return null;
  return <LabelList position={position} offset={6} fontSize={11} className="fill-current" />;
}

// One measure per pie, so it draws the first series and colors by slice.
function pie(spec: ChartSpec, legend: ChartLegendEntry[]) {
  return (
    <PieChart>
      <ChartTooltip content={<ChartTooltipContent nameKey={spec.x} />} />
      <Pie
        data={spec.data}
        dataKey={spec.series[0].key}
        nameKey={spec.x}
        innerRadius={45}
        strokeWidth={2}
        label={spec.showValues}
      >
        {legend.map((entry, index) => (
          <Cell key={index} fill={entry.color} />
        ))}
      </Pie>
      {legendOf(spec, spec.x)}
    </PieChart>
  );
}

// The same one measure as a pie, drawn as a ring per row. A radial bar takes its color
// from the row it draws rather than from a child element, so the rows are handed to it
// with the slice color written in.
function radial(spec: ChartSpec, legend: ChartLegendEntry[]) {
  const data = spec.data.map((row, index) => ({ ...row, fill: legend[index].color }));
  return (
    <RadialBarChart data={data} innerRadius="25%" outerRadius="100%">
      <ChartTooltip content={<ChartTooltipContent nameKey={spec.x} />} />
      <RadialBar dataKey={spec.series[0].key} background cornerRadius={4}>
        {valueLabels(spec, 'insideStart')}
      </RadialBar>
      {legendOf(spec, spec.x)}
    </RadialBarChart>
  );
}

// Every series over the same categories, drawn as a shape with one corner per
// category — what compares several measures that share a scale.
function radar(spec: ChartSpec) {
  return (
    <RadarChart data={spec.data}>
      <ChartTooltip content={<ChartTooltipContent />} />
      <PolarGrid />
      <PolarAngleAxis dataKey={spec.x} fontSize={11} />
      {spec.series.map((series, index) => (
        <Radar
          key={series.key}
          dataKey={series.key}
          stroke={seriesColor(series, index)}
          fill={seriesColor(series, index)}
          fillOpacity={0.25}
        >
          {valueLabels(spec, 'top')}
        </Radar>
      ))}
      {legendOf(spec)}
    </RadarChart>
  );
}

// The stages of a funnel, widest first. Recharts draws no legend for it, so the name
// of every stage is written into the trapezoid it belongs to — white, because it sits
// on the slice color in either theme. The last stage is a trapezoid like the rest:
// recharts otherwise runs it into a point, which reads as a stage that ends at zero.
function funnel(spec: ChartSpec, legend: ChartLegendEntry[]) {
  return (
    <FunnelChart>
      <ChartTooltip content={<ChartTooltipContent nameKey={spec.x} />} />
      <Funnel
        dataKey={spec.series[0].key}
        nameKey={spec.x}
        data={spec.data}
        lastShapeType="rectangle"
      >
        {legend.map((entry, index) => (
          <Cell key={index} fill={entry.color} />
        ))}
        <LabelList dataKey={spec.x} position="center" fontSize={11} fill="#ffffff" stroke="none" />
        {spec.showValues && (
          <LabelList
            dataKey={spec.series[0].key}
            position="right"
            fontSize={11}
            className="fill-current"
          />
        )}
      </Funnel>
    </FunnelChart>
  );
}

// One rectangle per row, its area the row's number — what a pie cannot do past a
// handful of categories. The name is drawn in the rectangle where it fits, so this
// chart carries no legend either; the colors are handed over as the panel recharts
// picks from by position.
function treemap(spec: ChartSpec, legend: ChartLegendEntry[]) {
  return (
    <Treemap
      data={spec.data}
      dataKey={spec.series[0].key}
      nameKey={spec.x}
      colorPanel={legend.map((entry) => entry.color)}
      aspectRatio={4 / 3}
      isAnimationActive={false}
    >
      <ChartTooltip content={<ChartTooltipContent nameKey={spec.x} />} />
    </Treemap>
  );
}

const percentTick = (value: number) => `${Math.round(value * 100)}%`;

// Bars, lines, areas, and points share every axis, so they are drawn by one composed
// chart that differs only in the mark each series gets — which is also what lets a
// series carry a mark of its own and one chart mix them.
function cartesian(spec: ChartSpec) {
  const percent = spec.stacked === 'percent';
  // A scatter chart puts a number on both axes; a horizontal one swaps which axis
  // carries the categories.
  const category = {
    dataKey: spec.x,
    type: spec.type === 'scatter' ? ('number' as const) : ('category' as const),
    tickMargin: 8,
  };
  const value = { type: 'number' as const, tickFormatter: percent ? percentTick : undefined };
  const axis = { tickLine: false, axisLine: false, fontSize: 11 };

  return (
    <ComposedChart
      data={spec.data}
      layout={spec.horizontal ? 'vertical' : 'horizontal'}
      stackOffset={percent ? 'expand' : undefined}
    >
      <CartesianGrid
        horizontal={!spec.horizontal}
        vertical={Boolean(spec.horizontal) || spec.type === 'scatter'}
      />
      <XAxis {...axis} {...(spec.horizontal ? value : category)} />
      <YAxis
        {...axis}
        {...(spec.horizontal ? category : value)}
        width={spec.horizontal ? 90 : 40}
      />
      <ChartTooltip content={<ChartTooltipContent />} />
      {spec.series.map((series, index) => mark(spec, series, seriesColor(series, index)))}
      {legendOf(spec)}
    </ComposedChart>
  );
}

function mark(spec: ChartSpec, series: ChartSeries, color: string) {
  const key = series.key;
  const stackId = spec.stacked ? 'a' : undefined;
  const curve = spec.curve ?? 'monotone';
  switch (series.type ?? spec.type) {
    case 'line':
      return (
        <Line key={key} dataKey={key} type={curve} stroke={color} strokeWidth={2} dot={false}>
          {valueLabels(spec, 'top')}
        </Line>
      );
    case 'area':
      return (
        <Area
          key={key}
          dataKey={key}
          type={curve}
          stackId={stackId}
          stroke={color}
          fill={color}
          fillOpacity={0.25}
        >
          {valueLabels(spec, 'top')}
        </Area>
      );
    case 'scatter':
      return <Scatter key={key} dataKey={key} fill={color} />;
    default:
      return (
        <Bar key={key} dataKey={key} stackId={stackId} fill={color} radius={3}>
          {valueLabels(spec, spec.horizontal ? 'right' : 'top')}
        </Bar>
      );
  }
}
