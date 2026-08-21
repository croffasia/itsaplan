import { startOfDay } from 'date-fns';
import { type BoardIssue, type Issue, type ProjectDetail } from '@/lib/api';
import { parseDate } from '@/utils/dates';
import type { FilterSet } from '@/utils/filters';
import { buildDayTrack, type DayTrack } from '@/utils/timelineTrack';
import {
  buildGroups,
  groupIssues,
  mergeAssign,
  nestIssues,
  sortIssues,
  subgroupKey,
  type GroupAssign,
  type GroupLabels,
  type IssueGroup,
} from '@/utils/project';
import type { Sort } from '@/utils/viewTypes';
import type { GroupField, TimelineScale } from '@/utils/viewSettings';

// px per day at each zoom level. Wider days keep the per-day numbers legible;
// narrower days fit longer ranges and fall back to weekly gridlines.
export const SCALE_DAY_W: Record<TimelineScale, number> = { week: 32, month: 12, quarter: 5 };
export const ROW_H = 36; // px, an issue row
export const LINK_ROW_H = 26; // px, a linked-issue sub-row under an issue row
export const GROUP_H = 32; // px, a state group header row
export const SUBGROUP_H = 28; // px, a sub-group header row under a group

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
// same row order and heights: one entry per group header, its sub-group headers
// when sub-grouped, then the issues. `assign` is the patch a drop onto the row
// applies, `bucket` the ordered issue list the drop position is measured against,
// and `index` the row's place in it — the same shape the table rows carry.
export type TimelineRow =
  | {
      kind: 'group';
      group: IssueGroup;
      count: number;
      collapsed: boolean;
      aggregateSpan: Span | null;
      assign: GroupAssign | null;
      bucket: BoardIssue[];
    }
  | {
      kind: 'subgroup';
      sub: IssueGroup;
      groupKey: string;
      count: number;
      collapsed: boolean;
      aggregateSpan: Span | null;
      assign: GroupAssign | null;
      bucket: BoardIssue[];
    }
  | {
      kind: 'issue';
      issue: BoardIssue;
      span: Span;
      index: number;
      assign: GroupAssign | null;
      bucket: BoardIssue[];
    };

// The span covering a section's bars, shown on its header row when collapsed.
function sectionSpan(issueRows: { span: Span }[]): Span | null {
  let start: Date | null = null;
  let end: Date | null = null;
  for (const { span } of issueRows) {
    if (!start || span.start < start) start = span.start;
    if (!end || span.end > end) end = span.end;
  }
  if (!start || !end) return null;
  return { start, end, inferredStart: false };
}

// The whole timeline layout derived from the project and the current viewport:
// the flattened rows plus the day track they are placed on.
export interface TimelineModel extends DayTrack {
  rows: TimelineRow[];
}

export function buildTimeline({
  project,
  filters,
  group,
  subgroup,
  sort,
  groupLabels,
  showEmptyGroups,
  collapsedGroups,
  viewportW,
  labelW,
  dayW,
}: {
  project: ProjectDetail;
  filters: FilterSet;
  group: GroupField;
  subgroup: GroupField;
  sort: Sort;
  groupLabels: GroupLabels;
  showEmptyGroups: boolean;
  collapsedGroups: Set<string>;
  viewportW: number;
  labelW: number;
  dayW: number;
}): TimelineModel {
  const sorted = sortIssues(project.issues, sort, project);
  const groups = buildGroups(project, group, groupLabels, filters);
  const subgrouped = group !== 'none' && subgroup !== 'none';
  const subGroups = subgrouped ? buildGroups(project, subgroup, groupLabels, filters) : [];
  const rows: TimelineRow[] = [];

  const spanned = (issues: BoardIssue[]) =>
    issues.map((issue) => ({ issue, span: effSpan(issue) }));

  if (!subgrouped) {
    const issuesByGroup = groupIssues(groups, sorted, group);
    for (const issueGroup of groups) {
      const bucket = issuesByGroup.get(issueGroup.key) ?? [];
      const issueRows = spanned(bucket);
      if (!showEmptyGroups && issueRows.length === 0) continue;
      const collapsed = collapsedGroups.has(issueGroup.key);
      rows.push({
        kind: 'group',
        group: issueGroup,
        count: issueRows.length,
        collapsed,
        aggregateSpan: sectionSpan(issueRows),
        assign: issueGroup.assign,
        bucket,
      });
      if (collapsed) continue;
      issueRows.forEach(({ issue, span }, index) => {
        rows.push({ kind: 'issue', issue, span, index, assign: issueGroup.assign, bucket });
      });
    }
  } else {
    const nested = nestIssues(groups, subGroups, sorted, group, subgroup);
    for (const issueGroup of groups) {
      const inner = nested.get(issueGroup.key)!;
      const bySub = subGroups.map((sub) => ({ sub, issueRows: spanned(inner.get(sub.key) ?? []) }));
      const count = bySub.reduce((sum, s) => sum + s.issueRows.length, 0);
      if (!showEmptyGroups && count === 0) continue;
      const collapsed = collapsedGroups.has(issueGroup.key);
      rows.push({
        kind: 'group',
        group: issueGroup,
        count,
        collapsed,
        aggregateSpan: sectionSpan(bySub.flatMap((s) => s.issueRows)),
        assign: issueGroup.assign,
        // Appending to a collapsed group lands after its last issue whichever
        // sub-group that one sits in, so the bucket is the whole group in
        // position order.
        bucket: subGroups
          .flatMap((sub) => inner.get(sub.key) ?? [])
          .sort((a, b) => a.position - b.position),
      });
      if (collapsed) continue;
      for (const { sub, issueRows } of bySub) {
        if (!showEmptyGroups && issueRows.length === 0) continue;
        const key = subgroupKey(issueGroup.key, sub.key);
        const subCollapsed = collapsedGroups.has(key);
        const assign = mergeAssign(issueGroup.assign, sub.assign);
        const bucket = issueRows.map((r) => r.issue);
        rows.push({
          kind: 'subgroup',
          sub,
          groupKey: key,
          count: issueRows.length,
          collapsed: subCollapsed,
          aggregateSpan: sectionSpan(issueRows),
          assign,
          bucket,
        });
        if (subCollapsed) continue;
        issueRows.forEach(({ issue, span }, index) => {
          rows.push({ kind: 'issue', issue, span, index, assign, bucket });
        });
      }
    }
  }

  // The date range the track covers: the group aggregates, so it spans every
  // issue whether or not its section is expanded.
  let min: Date | null = null;
  let max: Date | null = null;
  for (const row of rows) {
    if (row.kind !== 'group' || !row.aggregateSpan) continue;
    if (!min || row.aggregateSpan.start < min) min = row.aggregateSpan.start;
    if (!max || row.aggregateSpan.end > max) max = row.aggregateSpan.end;
  }

  return { rows, ...buildDayTrack({ min, max, viewportW, labelW, dayW }) };
}
