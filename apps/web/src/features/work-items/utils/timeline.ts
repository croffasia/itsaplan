import { format, startOfDay } from 'date-fns';
import { type Issue, type ProjectDetail } from '@/lib/api';
import { addDays, daysBetween, parseDate } from '@/utils/dates';
import { buildGroups, groupIssues, type IssueGroup } from '@/utils/project';
import type { GroupField, TimelineScale } from '@/utils/viewSettings';

// px per day at each zoom level. Wider days keep the per-day numbers legible;
// narrower days fit longer ranges and fall back to weekly gridlines.
export const SCALE_DAY_W: Record<TimelineScale, number> = { week: 32, month: 12, quarter: 5 };
export const LABEL_W = 256; // px, the left issue-label column (matches w-64)
export const ROW_H = 36; // px, an issue row
export const GROUP_H = 32; // px, a state group header row

// An issue's bar span. Effective start is its start date, or its creation date
// when no start date is set (inferredStart) — normal Gantt practice so every
// issue has a bar. Effective end is the due date, or the start when there is
// no due date (a single-day marker).
export interface Span {
  start: Date;
  end: Date;
  inferredStart: boolean;
}

export function effSpan(issue: Issue): Span {
  const created = startOfDay(new Date(issue.createdAt));
  const startRaw = parseDate(issue.startDate);
  const dueRaw = parseDate(issue.dueDate);
  let start = startRaw ?? created;
  const end = dueRaw ?? start;
  if (end < start) start = end; // a due date before the start collapses the bar to a single day
  return { start, end, inferredStart: startRaw == null };
}

// A flat render list so the left labels and the right tracks share the exact
// same row order and heights: one entry per state group header, then its issues.
export type TimelineRow =
  | {
      kind: 'group';
      group: IssueGroup;
      count: number;
      collapsed: boolean;
      aggregateSpan: Span | null;
    }
  | { kind: 'issue'; issue: Issue; span: Span; groupKey: string };

// A consecutive same-month run, for the month labels above the day numbers.
export interface MonthLabel {
  label: string;
  left: number;
  width: number;
}

// The whole timeline layout derived from the project and the current viewport:
// the flattened rows, the day columns and their month labels, the track width
// (extended with trailing days so it always fills the viewport), the today
// marker, the gridline background, and a helper to place a span's bar.
export interface TimelineModel {
  rows: TimelineRow[];
  days: Date[];
  months: MonthLabel[];
  trackWidth: number;
  todayLeft: number;
  todayInRange: boolean;
  dayLines: { backgroundImage: string };
  spanToRect: (start: Date, end: Date) => { left: number; width: number };
}

export function buildTimeline({
  project,
  group,
  showEmptyGroups,
  collapsedGroups,
  viewportW,
  labelW,
  dayW,
}: {
  project: ProjectDetail;
  group: GroupField;
  showEmptyGroups: boolean;
  collapsedGroups: Set<string>;
  viewportW: number;
  labelW: number;
  dayW: number;
}): TimelineModel {
  const groups = buildGroups(project, group);
  const issuesByGroup = groupIssues(groups, project.issues, group);
  // Rows, and the date range that covers every bar (plus padding and today).
  const rows: TimelineRow[] = [];
  const today = startOfDay(new Date());
  let min: Date | null = null;
  let max: Date | null = null;
  for (const issueGroup of groups) {
    const issues = issuesByGroup.get(issueGroup.key) ?? [];
    if (!showEmptyGroups && issues.length === 0) continue;
    const issueRows = issues.map((issue) => ({ issue, span: effSpan(issue) }));
    let groupStart: Date | null = null;
    let groupEnd: Date | null = null;
    for (const { span } of issueRows) {
      if (!groupStart || span.start < groupStart) groupStart = span.start;
      if (!groupEnd || span.end > groupEnd) groupEnd = span.end;
      if (!min || span.start < min) min = span.start;
      if (!max || span.end > max) max = span.end;
    }
    const aggregateSpan =
      groupStart && groupEnd ? { start: groupStart, end: groupEnd, inferredStart: false } : null;
    const collapsed = collapsedGroups.has(issueGroup.key);
    rows.push({ kind: 'group', group: issueGroup, count: issues.length, collapsed, aggregateSpan });
    if (collapsed) continue;
    for (const { issue, span } of issueRows) {
      rows.push({ kind: 'issue', issue, span, groupKey: issueGroup.key });
    }
  }

  const rangeStart = addDays(min ?? today, -3);
  const rangeEnd = addDays(max ?? addDays(today, 28), 7);
  // Extend the range on the right with trailing days so the track always fills
  // the available width; the day size stays fixed.
  const naturalDays = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);
  const daysToFill = Math.ceil(Math.max(0, viewportW - labelW) / dayW);
  const totalDays = Math.max(naturalDays, daysToFill);
  const trackWidth = totalDays * dayW;
  const days = Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));

  const months: MonthLabel[] = [];
  for (let i = 0; i < days.length; i++) {
    const label = format(days[i], 'MMMM yyyy');
    const last = months[months.length - 1];
    if (last && last.label === label) last.width += dayW;
    else months.push({ label, left: i * dayW, width: dayW });
  }

  // Per-day gridlines when days are wide; weekly gridlines when zoomed out, so
  // narrow days do not turn the track into solid lines.
  const gridPeriod = dayW >= 20 ? dayW : dayW * 7;
  const dayLines = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${gridPeriod - 1}px, var(--border) ${gridPeriod - 1}px, var(--border) ${gridPeriod}px)`,
  };
  const todayLeft = daysBetween(rangeStart, today) * dayW;
  const todayInRange = today >= rangeStart && today <= rangeEnd;

  const spanToRect = (start: Date, end: Date) => ({
    left: daysBetween(rangeStart, start) * dayW,
    width: (daysBetween(start, end) + 1) * dayW,
  });

  return { rows, days, months, trackWidth, todayLeft, todayInRange, dayLines, spanToRect };
}
