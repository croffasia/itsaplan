import { type Column, type StateType, type TimelineSegment } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';

// Turns the API's status segments into the geometry the timeline renders: one lane
// per status the issue passed through, each holding its stretches placed on a shared
// time axis. Percentages, so the lanes scale with whatever width the surrounding
// layout gives them.

// The default project_column color, used when a segment's status no longer matches
// a live column (renamed or deleted since the change was logged).
const FALLBACK_COLOR = '#6b7280';

// Roughly how many labelled ticks the axis aims for.
const TICK_TARGET = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TimelineBar {
  segment: TimelineSegment;
  leftPct: number;
  widthPct: number;
}

export interface TimelineLane {
  // The status name, or a stand-in when the segment carries none (no status history
  // and the column was deleted). Unique per lane, so it doubles as the render key.
  label: string;
  color: string;
  // Time spent in this status across all its stretches.
  totalMs: number;
  bars: TimelineBar[];
}

export interface TimelineTick {
  leftPct: number;
  label: string;
}

export interface TimelineLayout {
  lanes: TimelineLane[];
  ticks: TimelineTick[];
}

export interface LifecycleMetrics {
  // Creation to the first time the issue entered a completed column, and the first
  // started column to that same moment. Null while the issue has not been completed,
  // and cycleMs also when it reached completed without ever passing a started column.
  leadMs: number | null;
  cycleMs: number | null;
}

// The lead and cycle time of the compact view. A status carries the column name it was
// logged with, so its state type is resolved by matching that name against the
// project's live columns; a status whose column was renamed or deleted resolves to
// undefined and counts as neither started nor completed.
export function buildLifecycleMetrics(
  segments: TimelineSegment[],
  columns: Column[],
): LifecycleMetrics {
  const byName = new Map<string, StateType>(columns.map((c) => [c.name, c.stateType]));
  const stateOf = (segment: TimelineSegment) =>
    segment.status ? byName.get(segment.status) : undefined;

  const completed = segments.find((segment) => stateOf(segment) === 'completed');
  const started = segments.find((segment) => stateOf(segment) === 'started');
  const leadMs = completed ? Date.parse(completed.from) - Date.parse(segments[0].from) : null;
  const cycleMs =
    completed && started ? Date.parse(completed.from) - Date.parse(started.from) : null;

  return {
    leadMs,
    // A completed column reached before any started one leaves no cycle to measure.
    cycleMs: cycleMs != null && cycleMs >= 0 ? cycleMs : null,
  };
}

export function buildTimelineLayout(
  segments: TimelineSegment[],
  columns: Column[],
): TimelineLayout {
  if (segments.length === 0) return { lanes: [], ticks: [] };

  const last = segments[segments.length - 1];
  const startMs = Date.parse(segments[0].from);
  const endMs = last.to ? Date.parse(last.to) : Date.now();
  // An issue created a moment ago spans ~0ms; a floor of one minute keeps the
  // division safe and the single bar visible.
  const spanMs = Math.max(endMs - startMs, 60_000);
  const colorByName = new Map(columns.map((c) => [c.name, c.color]));

  const lanes: TimelineLane[] = [];
  const laneByStatus = new Map<string | null, TimelineLane>();
  for (const segment of segments) {
    let lane = laneByStatus.get(segment.status);
    if (!lane) {
      lane = {
        label: segment.status ?? 'Unknown status',
        color: (segment.status && colorByName.get(segment.status)) || FALLBACK_COLOR,
        totalMs: 0,
        bars: [],
      };
      laneByStatus.set(segment.status, lane);
      lanes.push(lane);
    }
    lane.totalMs += segment.durationMs;
    lane.bars.push({
      segment,
      leftPct: ((Date.parse(segment.from) - startMs) / spanMs) * 100,
      widthPct: (segment.durationMs / spanMs) * 100,
    });
  }

  return { lanes, ticks: buildTicks(startMs, spanMs) };
}

// Evenly spaced date labels along the axis, stepping in whole days so a tick always
// falls on the same time of day. A span shorter than a day gets its two ends only.
function buildTicks(startMs: number, spanMs: number): TimelineTick[] {
  const stepMs = Math.ceil(spanMs / TICK_TARGET / DAY_MS) * DAY_MS;
  if (stepMs > spanMs) {
    return [
      { leftPct: 0, label: formatShortDate(new Date(startMs).toISOString()) },
      { leftPct: 100, label: formatShortDate(new Date(startMs + spanMs).toISOString()) },
    ];
  }
  const ticks: TimelineTick[] = [];
  for (let at = startMs; at <= startMs + spanMs; at += stepMs) {
    ticks.push({
      leftPct: ((at - startMs) / spanMs) * 100,
      label: formatShortDate(new Date(at).toISOString()),
    });
  }
  return ticks;
}
