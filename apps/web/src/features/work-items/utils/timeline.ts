import { startOfDay } from 'date-fns';
import { type BoardIssue, type Issue, type ProjectDetail } from '@/lib/api';
import { parseDate } from '@/utils/dates';
import { buildDayTrack, type DayTrack } from '@/utils/timelineTrack';
import { buildGroups, groupIssues, type GroupLabels, type IssueGroup } from '@/utils/project';
import type { GroupField, TimelineScale } from '@/utils/viewSettings';

// px per day at each zoom level. Wider days keep the per-day numbers legible;
// narrower days fit longer ranges and fall back to weekly gridlines.
export const SCALE_DAY_W: Record<TimelineScale, number> = { week: 32, month: 12, quarter: 5 };
export const ROW_H = 36; // px, an issue row
export const LINK_ROW_H = 26; // px, a linked-issue sub-row under an issue row
export const GROUP_H = 32; // px, a state group header row

// The dragged label-column width is a client-only preference, kept per project
// and per saved view (the tab the timeline is open on), so each of them keeps the
// room its titles need. `null` is the project's unsaved "All" tab.
export function labelWidthKey(projectKey: string, viewId: number | null): string {
  return `timeline-label-width:${projectKey}:${viewId ?? 'all'}`;
}

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
  | { kind: 'issue'; issue: BoardIssue; span: Span; groupKey: string };

// The whole timeline layout derived from the project and the current viewport:
// the flattened rows plus the day track they are placed on.
export interface TimelineModel extends DayTrack {
  rows: TimelineRow[];
}

export function buildTimeline({
  project,
  group,
  groupLabels,
  showEmptyGroups,
  collapsedGroups,
  viewportW,
  labelW,
  dayW,
}: {
  project: ProjectDetail;
  group: GroupField;
  groupLabels: GroupLabels;
  showEmptyGroups: boolean;
  collapsedGroups: Set<string>;
  viewportW: number;
  labelW: number;
  dayW: number;
}): TimelineModel {
  const groups = buildGroups(project, group, groupLabels);
  const issuesByGroup = groupIssues(groups, project.issues, group);
  // Rows, and the date range that covers every bar.
  const rows: TimelineRow[] = [];
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

  return { rows, ...buildDayTrack({ min, max, viewportW, labelW, dayW }) };
}
