import { type CustomField, type Issue, type IssuePatch } from '@/lib/api';
import { groupIssues, mergeAssign, nestIssues, type IssueGroup } from '@/utils/project';
import {
  customFieldId,
  isCustomFieldKey,
  type ViewSettings,
  type DisplayProperty,
  type PropertyKey,
} from '@/utils/viewSettings';

// The grid columns after the (always-present) title cell. 'id' is not here — the
// identifier renders inside the title cell.
export type TableColumn = Exclude<DisplayProperty, 'id'>;
export const COLUMN_META: Record<TableColumn, { label: string; width: string }> = {
  status: { label: 'State', width: '130px' },
  statusAge: { label: 'In status', width: '88px' },
  priority: { label: 'Priority', width: '88px' },
  type: { label: 'Type', width: '120px' },
  assignee: { label: '', width: '56px' },
  delegate: { label: '', width: '56px' },
  initiative: { label: 'Initiative', width: 'minmax(140px,220px)' },
  labels: { label: 'Labels', width: 'minmax(120px,220px)' },
  startDate: { label: 'Start', width: '96px' },
  dueDate: { label: 'Due', width: '96px' },
  created: { label: 'Created', width: '96px' },
  updated: { label: 'Updated', width: '96px' },
};

// Collapsed sections are a per-project, per-grouping client-only preference,
// persisted so it survives reloads (same pattern as the project's hidden groups).
// The sub-grouping field is part of the key so a different sub-grouping keeps its
// own collapse set.
export function collapsedKey(projectId: number, group: string, subgroup: string): string {
  return `kanban-table-collapsed:${projectId}:${group}:${subgroup}`;
}

// Collapse key for a sub-section: primary group key + sub-group key, so the same
// sub-group value under two different primary groups collapses independently.
function subKey(groupKey: string, sgKey: string): string {
  return `${groupKey}::${sgKey}`;
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
      assign: IssuePatch | null;
      bucket: Issue[];
      dropKey: string;
    }
  | {
      kind: 'subheader';
      sub: IssueGroup;
      count: number;
      assign: IssuePatch | null;
      bucket: Issue[];
      dropKey: string;
    }
  | {
      kind: 'row';
      issue: Issue;
      index: number;
      assign: IssuePatch | null;
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
  sorted: Issue[];
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
        const key = subKey(group.key, sg.key);
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
function columnWidth(c: OrderedColumn): string {
  if (c.kind === 'builtin') return COLUMN_META[c.col].width;
  return c.field.fieldType === 'markdown' ? MARKDOWN_COLUMN_WIDTH : CUSTOM_COLUMN_WIDTH;
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
function minTableWidth(columns: OrderedColumn[]): number {
  const tracks =
    trackFloor(TITLE_COLUMN_WIDTH) +
    columns.reduce((sum, c) => sum + trackFloor(columnWidth(c)), 0);
  return ROW_PADDING + COLUMN_GAP * columns.length + tracks;
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
  const gridTemplate = [TITLE_COLUMN_WIDTH, ...columns.map(columnWidth)].join(' ');
  const minWidth = minTableWidth(columns);
  const alignTop = columns.some((c) => c.kind === 'custom' && c.field.fieldType === 'markdown');
  return { columns, gridTemplate, minWidth, alignTop };
}
