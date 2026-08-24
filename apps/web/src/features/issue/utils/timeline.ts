import { type Column, type StateType, type TimelineSegment } from '@/lib/api';
import { formatDuration, formatShortDate } from '@/utils/dates';

// Turns the API's status segments into the geometry the timeline renders: one lane
// per status the issue passed through, each holding its stretches placed on a shared
// time axis. Percentages, so the lanes scale with whatever width the surrounding
// layout gives them.

// The default project_column color, used when a segment's status no longer matches
// a live column (deleted since the issue passed through it).
const FALLBACK_COLOR = '#6b7280';

// Roughly how many labelled ticks the axis aims for.
const TICK_TARGET = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TimelineBar {
  segment: TimelineSegment;
  leftPct: number;
  widthPct: number;
  // The stretch left after the work is over: parked at the end of the axis, with a
  // width the renderer fixes rather than one taken from the span.
  fixed: boolean;
}

export interface TimelineLane {
  // The status name, or a stand-in when the segment carries none. Unique per lane,
  // so it doubles as the render key.
  label: string;
  color: string;
  stateType: StateType | undefined;
  // Where the status sits among the project's columns, for the views that show the
  // statuses in the project's own order rather than in the order the issue met them.
  // Statuses whose column is gone come last.
  order: number;
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
  hasFixedTail: boolean;
}

export interface LifecycleMetrics {
  // Creation to the first time the issue entered a completed column, and the first
  // started column to that same moment. Null while the issue has not been completed,
  // and cycleMs also when it reached completed without ever passing a started column.
  leadMs: number | null;
  cycleMs: number | null;
}

// "<1m" where formatDuration reads "0m", and empty for a figure the issue has not
// reached yet.
export function durationLabel(ms: number | null): string {
  if (ms == null) return '';
  return ms < 60_000 ? '<1m' : formatDuration(ms);
}

// A status carries the column name it was logged with, so it is matched against the
// project's live columns by that name; a status whose column was renamed or deleted
// matches nothing and counts as no state type at all. The index is the column's place
// in the project's own order.
function columnResolver(columns: Column[]) {
  const byName = new Map(columns.map((column, index) => [column.name, { column, index }]));
  return (status: string | null) => (status ? byName.get(status) : undefined);
}

// The lead and cycle time of the compact view.
export function buildLifecycleMetrics(
  segments: TimelineSegment[],
  columns: Column[],
): LifecycleMetrics {
  const columnOf = columnResolver(columns);
  const stateOf = (segment: TimelineSegment) => columnOf(segment.status)?.column.stateType;

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

// The color to mark a status with, for the views that carry a name snapshot rather
// than a column (the grouped activity log).
export function statusColor(columns: Column[], status: string | null): string {
  return columnResolver(columns)(status)?.column.color || FALLBACK_COLOR;
}

export function buildTimelineLayout(
  segments: TimelineSegment[],
  columns: Column[],
  // Names a segment whose status the project no longer has.
  unknownStatus: string,
): TimelineLayout {
  if (segments.length === 0) return { lanes: [], ticks: [], hasFixedTail: false };

  const columnOf = columnResolver(columns);
  const last = segments[segments.length - 1];
  // The stretch the issue sits in after the work is over has no end and grows every
  // day, so it is drawn at a fixed width and the axis stops where it began.
  const fixedTail = columnOf(last.status)?.column.stateType === 'completed' ? last : null;
  const startMs = Date.parse(segments[0].from);
  let endMs: number;
  if (fixedTail) endMs = Date.parse(fixedTail.from);
  else if (last.to) endMs = Date.parse(last.to);
  else endMs = Date.now();
  // An issue created a moment ago spans ~0ms; a floor of one minute keeps the
  // division safe and the single bar visible.
  const spanMs = Math.max(endMs - startMs, 60_000);

  const lanes: TimelineLane[] = [];
  const laneByStatus = new Map<string | null, TimelineLane>();
  for (const segment of segments) {
    let lane = laneByStatus.get(segment.status);
    if (!lane) {
      const found = columnOf(segment.status);
      lane = {
        label: segment.status ?? unknownStatus,
        color: found?.column.color || FALLBACK_COLOR,
        stateType: found?.column.stateType,
        order: found?.index ?? columns.length,
        totalMs: 0,
        bars: [],
      };
      laneByStatus.set(segment.status, lane);
      lanes.push(lane);
    }
    lane.totalMs += segment.durationMs;
    const fixed = segment === fixedTail;
    lane.bars.push({
      segment,
      leftPct: fixed ? 100 : ((Date.parse(segment.from) - startMs) / spanMs) * 100,
      widthPct: fixed ? 0 : (segment.durationMs / spanMs) * 100,
      fixed,
    });
  }

  return { lanes, ticks: buildTicks(startMs, spanMs), hasFixedTail: fixedTail != null };
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
