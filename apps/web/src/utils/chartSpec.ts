// The chart spec: one JSON shape that describes a chart. An agent sends it to the
// create_chart endpoint, which checks it and answers with it, and then writes it into
// a ```chart fence in its answer. The shared Markdown component draws that fence with
// ChartBlock, so the spec is the only thing the two ends have to agree on.
//
// The api validates the same shape in TypeBox (see
// apps/api/src/modules/charts/model.ts); this file is the browser's copy, next to the
// other types the web app keeps for what it reads over HTTP.

const CHART_TYPES = [
  'bar',
  'line',
  'area',
  'pie',
  'radar',
  'radial',
  'scatter',
  'funnel',
  'treemap',
] as const;

export type ChartType = (typeof CHART_TYPES)[number];

// The types whose shapes are one per data row rather than one per series, so each of
// them is colored, labelled, and drawn from the first series alone.
const SLICE_TYPES: ChartType[] = ['pie', 'radial', 'funnel', 'treemap'];

// The types that write the name of every shape inside the drawing, so a legend under
// it would say the same thing twice.
const SELF_LABELLED_TYPES: ChartType[] = ['funnel', 'treemap'];

export interface ChartSeries {
  // The key of this series in every data row.
  key: string;
  label?: string;
  color?: string;
  // Draws this series as something other than what the chart's own type says, which
  // is what lets one chart carry bars and a line.
  type?: 'bar' | 'line' | 'area';
}

export interface ChartSpec {
  type: ChartType;
  // The key of the category (x axis for bar/line/area/scatter, slice name for
  // pie/radial, corner name for radar).
  x: string;
  title?: string;
  series: ChartSeries[];
  data: Record<string, string | number | null>[];
  stacked?: boolean | 'percent';
  horizontal?: boolean;
  curve?: 'monotone' | 'linear' | 'step';
  showValues?: boolean;
}

// Slice and series colors for a spec that names none, by position.
export const CHART_PALETTE = [
  '#6366f1',
  '#22c55e',
  '#eab308',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#8b5cf6',
  '#64748b',
];

export function seriesColor(series: ChartSeries, index: number): string {
  return series.color ?? CHART_PALETTE[index % CHART_PALETTE.length];
}

export function isSliceChart(spec: ChartSpec): boolean {
  return SLICE_TYPES.includes(spec.type);
}

// Whether a legend is drawn under the chart at all. The drawn chart and the exported
// file both ask this, so a file cannot end up with a legend the chart never had.
export function chartHasLegend(spec: ChartSpec): boolean {
  return !SELF_LABELLED_TYPES.includes(spec.type) && chartLegend(spec).length > 1;
}

export interface ChartLegendEntry {
  key: string;
  label: string;
  color: string;
}

// What the legend of a chart lists, and in what color. A pie, a radial, a funnel, and
// a treemap are colored by shape, so their entries are the categories in the data;
// every other type draws one mark per series, so its entries are the series. Both the
// drawn chart and the exported file read the legend from here, which is what keeps
// their colors and labels in step.
export function chartLegend(spec: ChartSpec): ChartLegendEntry[] {
  if (isSliceChart(spec)) {
    // The palette is read by position rather than through seriesColor: a color set on
    // the single series would otherwise paint every slice the same.
    return spec.data.map((row, index) => {
      const name = String(row[spec.x] ?? '');
      return { key: name, label: name, color: CHART_PALETTE[index % CHART_PALETTE.length] };
    });
  }
  return spec.series.map((series, index) => ({
    key: series.key,
    label: series.label ?? series.key,
    color: seriesColor(series, index),
  }));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSeries(value: unknown): boolean {
  return isObject(value) && typeof value.key === 'string' && value.key !== '';
}

// A spec parsed out of an agent's JSON, or null when it is not one. The text is
// written by a model, so the fields recharts needs a value for — type, x, series, and
// data — are checked here: recharts throws on a missing dataKey rather than drawing an
// empty chart.
export function parseChartSpec(text: string): ChartSpec | null {
  // Read from the first brace to the last one rather than parsing the text whole: a
  // model writes the odd stray token next to the spec — a trailing `</br>` is the one
  // seen — and dropping it draws the chart instead of showing the JSON raw.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) return null;
  let value: unknown;
  try {
    value = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!isObject(value)) return null;
  if (!CHART_TYPES.includes(value.type as ChartType)) return null;
  if (typeof value.x !== 'string' || !value.x) return null;
  if (!Array.isArray(value.series) || value.series.length === 0) return null;
  if (!value.series.every(isSeries)) return null;
  if (!Array.isArray(value.data) || value.data.length === 0) return null;
  if (!value.data.every(isObject)) return null;
  return value as unknown as ChartSpec;
}
