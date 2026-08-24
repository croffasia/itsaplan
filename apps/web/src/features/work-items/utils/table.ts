import { type BoardIssue, type CustomField, type Issue } from '@/lib/api';
import {
  groupIssues,
  mergeAssign,
  nestIssues,
  subgroupKey,
  type GroupAssign,
  type IssueGroup,
} from '@/utils/project';
import {
  customFieldId,
  isCustomFieldKey,
  type ViewSettings,
  type DisplayProperty,
  type PropertyKey,
} from '@/utils/viewSettings';

// The grid columns after the (always-present) title cell. 'id' is not here — the
// identifier renders inside the title cell. The header label of a column is a
// message under `workItems.columns`; assignee and delegate head their avatars
// with an icon and have none.
export type TableColumn = Exclude<DisplayProperty, 'id'>;
export const COLUMN_META: Record<TableColumn, { width: string }> = {
  status: { width: '130px' },
  statusAge: { width: '88px' },
  priority: { width: '88px' },
  type: { width: '120px' },
  assignee: { width: '56px' },
  delegate: { width: '56px' },
  initiative: { width: 'minmax(140px,220px)' },
  cycle: { width: 'minmax(120px,180px)' },
  labels: { width: 'minmax(120px,220px)' },
  estimatePoints: { width: '110px' },
  estimateTime: { width: '88px' },
  startDate: { width: '96px' },
  dueDate: { width: '96px' },
  created: { width: '96px' },
  updated: { width: '96px' },
};

// A dragged width (px) per grid track, keyed by columnKey() — or by
// TITLE_COLUMN_KEY for the title cell, which is a track like the others but has
// no OrderedColumn. A hidden column keeps its entry, so showing it again brings
// its last width back.
export type ColumnWidths = Record<string, number>;
export const TITLE_COLUMN_KEY = 'title';
export const MIN_COLUMN_WIDTH = 56;
export const MAX_COLUMN_WIDTH = 800;

// Dragged widths are a client-only preference, kept per project and per scope:
// each saved view has its own set, the All tab has one, and the cycle and
// initiative boards share one set each across every cycle / initiative.
export function columnWidthsKey(projectKey: string, scope: string): string {
  return `table-column-widths:${projectKey}:${scope}`;
}

// Collapsed sections are a per-project, per-grouping client-only preference,
// persisted so it survives reloads (same pattern as the project's hidden groups).
// The sub-grouping field is part of the key so a different sub-grouping keeps its
// own collapse set.
export function collapsedKey(projectId: number, group: string, subgroup: string): string {
  return `kanban-table-collapsed:${projectId}:${group}:${subgroup}`;
}

// The list is flattened to one array of section headers and issue rows, then
// virtualized in a single scroll container, so a large backlog renders only the
// rows in (and near) the viewport. `index` on a row is its position within its
// cell's issue list, used to compute the drop position. `assign` is the patch a
// drop onto this item applies (the group/sub-group reassignment); `bucket` is
// the ordered issue list the drop position is measured against. `dropKey`
// identifies the section for the droppable id.
export type FlatItem =
  | {
      kind: 'header';
      group: IssueGroup;
      count: number;
      assign: GroupAssign | null;
      bucket: Issue[];
      dropKey: string;
    }
  | {
      kind: 'subheader';
      sub: IssueGroup;
      count: number;
      assign: GroupAssign | null;
      bucket: Issue[];
      dropKey: string;
    }
  | {
      kind: 'row';
      issue: BoardIssue;
      index: number;
      assign: GroupAssign | null;
      bucket: Issue[];
      dropKey: string;
    };

// Flatten the (optionally two-level) grouping into the virtualized item list. A
// row's drop `assign` and `bucket` come from the cell it sits in, so the
// virtualizer render stays a plain lookup-free map.
export function buildTableItems({
  groups,
  subGroups,
  sorted,
  settings,
  collapsed,
}: {
  groups: IssueGroup[];
  subGroups: IssueGroup[];
  sorted: BoardIssue[];
  settings: ViewSettings;
  collapsed: Set<string>;
}): FlatItem[] {
  const grouped = settings.group !== 'none';
  const subgrouped = grouped && settings.subgroup !== 'none';
  const items: FlatItem[] = [];

  if (!grouped) {
    sorted.forEach((issue, index) =>
      items.push({ kind: 'row', issue, index, assign: null, bucket: sorted, dropKey: 'all' }),
    );
  } else if (!subgrouped) {
    const issuesByGroup = groupIssues(groups, sorted, settings.group);
    for (const group of groups) {
      const issues = issuesByGroup.get(group.key) ?? [];
      if (!settings.showEmptyGroups && issues.length === 0) continue;
      items.push({
        kind: 'header',
        group,
        count: issues.length,
        assign: group.assign,
        bucket: issues,
        dropKey: group.key,
      });
      if (!collapsed.has(group.key)) {
        issues.forEach((issue, index) =>
          items.push({
            kind: 'row',
            issue,
            index,
            assign: group.assign,
            bucket: issues,
            dropKey: group.key,
          }),
        );
      }
    }
  } else {
    const nested = nestIssues(groups, subGroups, sorted, settings.group, settings.subgroup);
    for (const group of groups) {
      const inner = nested.get(group.key)!;
      // The bucket a drop onto the collapsed group header appends to: every
      // sub-group's issues, in position order, so appending past the last one
      // lands after the whole group rather than after one sub-group.
      const allIssues = subGroups
        .flatMap((sg) => inner.get(sg.key) ?? [])
        .sort((a, b) => a.position - b.position);
      if (!settings.showEmptyGroups && allIssues.length === 0) continue;
      items.push({
        kind: 'header',
        group,
        count: allIssues.length,
        assign: group.assign,
        bucket: allIssues,
        dropKey: group.key,
      });
      if (collapsed.has(group.key)) continue;
      for (const sg of subGroups) {
        const issues = inner.get(sg.key) ?? [];
        if (!settings.showEmptyGroups && issues.length === 0) continue;
        const key = subgroupKey(group.key, sg.key);
        const assign = mergeAssign(group.assign, sg.assign);
        items.push({
          kind: 'subheader',
          sub: sg,
          count: issues.length,
          assign,
          bucket: issues,
          dropKey: key,
        });
        if (collapsed.has(key)) continue;
        issues.forEach((issue, index) =>
          items.push({ kind: 'row', issue, index, assign, bucket: issues, dropKey: key }),
        );
      }
    }
  }

  return items;
}

// Grid width for a custom-field column; markdown fields render their full content
// so they get a wider track.
const CUSTOM_COLUMN_WIDTH = 'minmax(120px,180px)';
const MARKDOWN_COLUMN_WIDTH = 'minmax(280px,480px)';

// Title column: flexible but capped, so it does not stretch across the whole
// table when few columns are shown; leftover width stays to the right.
const TITLE_COLUMN_WIDTH = 'minmax(220px,520px)';

// A resolved Table column, either a built-in property or a custom field. The
// order of these follows settings.properties (reorderable in the Display panel).
export type OrderedColumn =
  { kind: 'builtin'; col: TableColumn } | { kind: 'custom'; field: CustomField };
export const columnKey = (c: OrderedColumn) => (c.kind === 'builtin' ? c.col : `cf${c.field.id}`);
function defaultColumnWidth(c: OrderedColumn): string {
  if (c.kind === 'builtin') return COLUMN_META[c.col].width;
  return c.field.fieldType === 'markdown' ? MARKDOWN_COLUMN_WIDTH : CUSTOM_COLUMN_WIDTH;
}

// A dragged width replaces the track's default, fixing it at that many pixels.
function trackWidth(key: string, defaultWidth: string, widths: ColumnWidths): string {
  const dragged = widths[key];
  return dragged ? `${dragged}px` : defaultWidth;
}

// Floor width of a grid track: the fixed value, or the lower bound of a minmax().
function trackFloor(w: string): number {
  const minmax = w.match(/minmax\(\s*(\d+)px/);
  return (minmax ? Number(minmax[1]) : parseInt(w, 10)) || 0;
}

// Minimum outer width (px) the table needs for every track to sit at its floor:
// the row's horizontal padding (px-4) + the inter-column gaps (gap-3) + each
// track's floor. Applied as a min-width so a narrow (phone) viewport scrolls
// horizontally and the group headers/rows stretch to the content width instead
// of clipping their background at the viewport edge. On desktop it is smaller
// than the viewport, so width:100% wins and nothing changes.
const ROW_PADDING = 32; // px-4 both sides
const COLUMN_GAP = 12; // gap-3
function minTableWidth(tracks: string[]): number {
  const floors = tracks.reduce((sum, t) => sum + trackFloor(t), 0);
  return ROW_PADDING + COLUMN_GAP * (tracks.length - 1) + floors;
}

// The table layout derived from the display settings: the ordered columns (each
// enabled built-in — except 'id', which lives in the title cell — or existing
// custom field, in settings.properties order), the CSS grid template, the
// scroll min-width, and whether cells should top-align (a markdown column can
// make a row tall).
interface TableLayout {
  columns: OrderedColumn[];
  gridTemplate: string;
  minWidth: number;
  alignTop: boolean;
}

export function resolveColumns(
  properties: PropertyKey[],
  customFields: CustomField[],
  widths: ColumnWidths,
): TableLayout {
  const builtins = new Set<string>(Object.keys(COLUMN_META));
  const fieldById = new Map(customFields.map((f) => [f.id, f]));
  const columns: OrderedColumn[] = properties.flatMap((p): OrderedColumn[] => {
    if (isCustomFieldKey(p)) {
      const field = fieldById.get(customFieldId(p));
      return field ? [{ kind: 'custom', field }] : [];
    }
    return builtins.has(p) ? [{ kind: 'builtin', col: p as TableColumn }] : [];
  });
  const tracks = [
    trackWidth(TITLE_COLUMN_KEY, TITLE_COLUMN_WIDTH, widths),
    ...columns.map((c) => trackWidth(columnKey(c), defaultColumnWidth(c), widths)),
  ];
  const gridTemplate = tracks.join(' ');
  const minWidth = minTableWidth(tracks);
  const alignTop = columns.some((c) => c.kind === 'custom' && c.field.fieldType === 'markdown');
  return { columns, gridTemplate, minWidth, alignTop };
}
