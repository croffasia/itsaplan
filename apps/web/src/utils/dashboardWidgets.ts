// Widget layout types for saved dashboards. The dashboard's `layout` is an
// ordered list of widget instances; the server stores it verbatim as a jsonb
// blob (like a saved view's filters/display) and never inspects it. These types
// live in the shared layer because api.ts types Dashboard.layout with them and
// the dashboards feature consumes them.

import type { FilterSet } from '@/utils/filters';

export type WidgetType =
  | 'stat'
  | 'recent_issues'
  | 'activity_feed'
  | 'pulse'
  | 'throughput'
  | 'breakdown'
  | 'agent_runs'
  | 'agent_health'
  | 'webhook_health'
  | 'agent_workload';

export type BreakdownBy = 'status' | 'priority' | 'type' | 'assignee' | 'delegate';

// The dashboard grid: a react-grid-layout board. Each widget has a position
// (`x`, `y`) and a size (`w` columns, `h` rows of ROW_UNIT px). In edit mode
// widgets are dragged by the header handle and resized from the corner.
export const GRID_COLS = 12;
export const ROW_UNIT = 40; // px per grid row
export const COL_GAP = 24; // px between columns
export const ROW_GAP = 16; // px between rows
export const MIN_W = 2;
export const MIN_H = 2;

// Per-type config. All fields optional — a widget renders with catalog defaults
// when its config is missing (an older layout, or a freshly added widget).
export interface WidgetConfig {
  // recent_issues
  sort?: 'created' | 'updated';
  // recent_issues and activity_feed — how many rows to show
  limit?: number;
  // recent_issues — the full board filter set (status/assignee/priority/labels/…)
  filters?: FilterSet;
  // activity_feed actor filter
  actorUserId?: string | null;
  typeId?: number | null;
  // activity_feed
  action?: string | null;
  // pulse — the heatmap bucket unit; the window auto-fits the widget width
  granularity?: 'hour' | 'day' | 'week';
  // throughput
  weeks?: number;
  // breakdown
  by?: BreakdownBy;
  // agent_runs — the run status filter (null = all)
  runStatus?: 'pending' | 'success' | 'failed' | null;
  // agent_health and webhook_health — the window in days
  days?: number;
}

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  x: number; // column position, 0-indexed
  y: number; // row position, 0-indexed
  w: number; // column span, 1..GRID_COLS
  h: number; // row span, in ROW_UNIT rows
  title?: string;
  config?: WidgetConfig;
}

export type DashboardLayout = WidgetInstance[];

// Default size and config per widget type, applied when a widget is added and as
// the fallback when a persisted widget omits a value. `minH` is the smallest row
// span that still fits the widget's content, so it can't be resized down until the
// content is hidden behind a scrollbar. Position (x/y) is assigned on add.
export const WIDGET_DEFAULTS: Record<
  WidgetType,
  { w: number; h: number; minH: number; config: WidgetConfig }
> = {
  stat: { w: 3, h: 3, minH: 2, config: {} },
  recent_issues: { w: 6, h: 7, minH: 3, config: { sort: 'created', limit: 10 } },
  activity_feed: { w: 6, h: 7, minH: 3, config: { limit: 20 } },
  pulse: { w: 12, h: 5, minH: 5, config: { granularity: 'day' } },
  throughput: { w: 6, h: 6, minH: 5, config: { weeks: 12 } },
  breakdown: { w: 6, h: 6, minH: 5, config: { by: 'status' } },
  agent_runs: { w: 6, h: 7, minH: 3, config: { limit: 20 } },
  agent_health: { w: 3, h: 3, minH: 3, config: { days: 30 } },
  webhook_health: { w: 3, h: 3, minH: 3, config: { days: 30 } },
  agent_workload: { w: 6, h: 6, minH: 3, config: {} },
};

// A fresh widget instance with a unique id and the type's default size/config.
// Placed at the origin; the editor drops it at the bottom of the current layout.
export function createWidget(type: WidgetType): WidgetInstance {
  const d = WIDGET_DEFAULTS[type];
  return { id: crypto.randomUUID(), type, x: 0, y: 0, w: d.w, h: d.h, config: { ...d.config } };
}

// Legacy layouts stored a `size` of 'full' | 'half' | 'quarter' instead of `w`.
const LEGACY_SIZE_W: Record<string, number> = { full: 12, half: 6, quarter: 3 };

// Normalizes a persisted widget's size/type. Handles older layouts that carry a
// `size` string or a missing width/height. Position is filled by normalizeLayout.
export function normalizeWidget(w: WidgetInstance): WidgetInstance {
  const legacy = (w as { size?: string }).size;
  const def = WIDGET_DEFAULTS[w.type] ?? WIDGET_DEFAULTS.stat;
  const width = Number.isFinite(w.w) ? w.w : legacy ? (LEGACY_SIZE_W[legacy] ?? def.w) : def.w;
  const height = Number.isFinite(w.h) ? w.h : def.h;
  return {
    id: w.id,
    type: w.type,
    title: w.title,
    config: w.config,
    x: Number.isFinite(w.x) ? w.x : 0,
    y: Number.isFinite(w.y) ? w.y : 0,
    w: Math.min(GRID_COLS, Math.max(MIN_W, Math.round(width))),
    h: Math.max(MIN_H, Math.round(height)),
  };
}

// Normalizes every widget and, for older layouts without positions, packs them
// left-to-right (wrapping at GRID_COLS) in list order so react-grid-layout has
// valid coordinates. New layouts already carry x/y and pass through unchanged.
export function normalizeLayout(layout: DashboardLayout): DashboardLayout {
  const needsPack = layout.some((it) => !Number.isFinite(it.x) || !Number.isFinite(it.y));
  const items = layout.map(normalizeWidget);
  if (!needsPack) return items;
  let x = 0;
  let y = 0;
  let rowH = 0;
  return items.map((it) => {
    if (x + it.w > GRID_COLS) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    const placed = { ...it, x, y };
    x += it.w;
    rowH = Math.max(rowH, it.h);
    return placed;
  });
}

// Preset filters for the default metric tiles, expressed with the same board
// filter set the widget configures. "Open" is any non-terminal state; the rest
// pin a single state or the unassigned bucket.
const OPEN_FILTER: FilterSet = {
  conditions: [
    { id: 'c1', field: 'statusType', op: 'is_not', values: ['completed', 'canceled', 'closed'] },
  ],
};
const IN_PROGRESS_FILTER: FilterSet = {
  conditions: [{ id: 'c1', field: 'statusType', op: 'is', values: ['started'] }],
};
const BACKLOG_FILTER: FilterSet = {
  conditions: [{ id: 'c1', field: 'statusType', op: 'is', values: ['backlog'] }],
};
const UNASSIGNED_FILTER: FilterSet = {
  conditions: [{ id: 'c1', field: 'assignee', op: 'is', values: [null] }],
};

// The built-in layout shown when a project has no saved dashboards. Saving it
// persists it as the project's first real dashboard. The top row is small metric
// tiles (each a filtered count), then the charts, pulse, and the two lists.
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = [
  {
    id: 'default-open',
    type: 'stat',
    x: 0,
    y: 0,
    w: 3,
    h: 3,
    title: 'Open',
    config: { filters: OPEN_FILTER },
  },
  {
    id: 'default-progress',
    type: 'stat',
    x: 3,
    y: 0,
    w: 3,
    h: 3,
    title: 'In progress',
    config: { filters: IN_PROGRESS_FILTER },
  },
  {
    id: 'default-backlog',
    type: 'stat',
    x: 6,
    y: 0,
    w: 3,
    h: 3,
    title: 'Backlog',
    config: { filters: BACKLOG_FILTER },
  },
  {
    id: 'default-unassigned',
    type: 'stat',
    x: 9,
    y: 0,
    w: 3,
    h: 3,
    title: 'Unassigned',
    config: { filters: UNASSIGNED_FILTER },
  },
  { id: 'default-throughput', type: 'throughput', x: 0, y: 3, w: 6, h: 6, config: { weeks: 12 } },
  { id: 'default-breakdown', type: 'breakdown', x: 6, y: 3, w: 6, h: 6, config: { by: 'status' } },
  { id: 'default-pulse', type: 'pulse', x: 0, y: 9, w: 12, h: 5, config: { granularity: 'day' } },
  {
    id: 'default-recent',
    type: 'recent_issues',
    x: 0,
    y: 14,
    w: 6,
    h: 7,
    config: { sort: 'created', limit: 10 },
  },
  { id: 'default-activity', type: 'activity_feed', x: 6, y: 14, w: 6, h: 7, config: {} },
];
