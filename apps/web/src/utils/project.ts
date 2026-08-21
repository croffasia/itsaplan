// Grouping, sorting and drop-position helpers shared by the project views (Project,
// Table, Timeline, Calendar) so they bucket and order issues the same way. Date
// and avatar helpers live in lib/dates and lib/avatar.

import type {
  Assignee,
  ProjectDetail,
  Column,
  CustomField,
  CycleOption,
  InitiativeOption,
  Label,
  StateType,
  InitiativeRef,
  Issue,
  IssuePatch,
  IssueType,
  NewIssueInput,
} from '@/lib/api';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import { PRIORITY_ORDER, PRIORITY_RANK } from '@/utils/fieldOptions';
import {
  hasValue,
  isEffectiveCondition,
  parseStatusValue,
  statusValue,
  type FilterCondition,
  type FilterSet,
  type FilterValue,
} from '@/utils/filters';
import { compareByGroupOrder } from '@/utils/initiativeMeta';
import {
  customFieldId,
  isCustomFieldKey,
  type CustomFieldKey,
  type GroupField,
  type ViewSettings,
} from '@/utils/viewSettings';
import {
  groupMemberField,
  memberCandidates,
  memberFieldValue,
  memberGroupKey,
} from '@/utils/memberFields';
import type { Sort } from '@/utils/viewTypes';

export type { Sort, SortField } from '@/utils/viewTypes';

// What a call site fills the create dialog with. A field it leaves out is the
// dialog's own choice: the first column, the default type, the current user.
export type NewIssueDefaults = Partial<
  Pick<
    NewIssueInput,
    | 'columnId'
    | 'typeId'
    | 'initiativeId'
    | 'cycleId'
    | 'assigneeUserId'
    | 'delegateUserId'
    | 'priority'
    | 'title'
    | 'description'
    | 'parentId'
    | 'labelIds'
  >
> & {
  // Member custom fields the dialog opens with, set once the issue exists (they
  // are not part of the create payload).
  fieldValues?: { fieldId: number; userId: string }[];
};

// The value a condition pins its field to. A field named by several conditions,
// or by one that allows several values, is not pinned to any.
function pinnedFilterValues(filters: FilterSet): Map<string, FilterValue | undefined> {
  const pinned = new Map<string, FilterValue | undefined>();
  for (const cond of filters.conditions) {
    if (cond.op !== 'is') continue;
    const pins = cond.values.length === 1 && !pinned.has(cond.field);
    pinned.set(cond.field, pins ? cond.values[0] : undefined);
  }
  return pinned;
}

// The one entity of a status, for a condition that pins a whole status ("the
// active cycle") instead of naming one. Several of them name nothing.
function onlyWithStatus(entities: { id: number; status: string }[], status: string) {
  const inStatus = entities.filter((e) => e.status === status);
  return inStatus.length === 1 ? inStatus[0].id : undefined;
}

// The defaults a new issue takes from the active filters, so an issue created on
// a filtered board stays visible on it. They fill in only what the call site left
// out — what the user pointed at wins over the filters.
export function defaultsFromFilters(
  filters: FilterSet,
  planned: { cycles: CycleOption[]; initiatives: InitiativeOption[] },
): NewIssueDefaults {
  const pinned = pinnedFilterValues(filters);
  const pinnedId = (field: string) => {
    const value = pinned.get(field);
    return typeof value === 'number' || value === null ? value : undefined;
  };
  const pinnedText = (field: string) => {
    const value = pinned.get(field);
    return typeof value === 'string' || value === null ? value : undefined;
  };

  const pinnedEntity = (field: string, entities: { id: number; status: string }[]) => {
    const value = pinned.get(field);
    if (typeof value === 'number' || value === null) return value;
    const status = parseStatusValue(value ?? null);
    return status === null ? undefined : onlyWithStatus(entities, status);
  };

  const labelId = pinnedId('labels');
  const defaults: NewIssueDefaults = {
    // A column is never pinned to null: every issue has one.
    columnId: pinnedId('status') ?? undefined,
    typeId: pinnedId('type'),
    initiativeId: pinnedEntity('initiative', planned.initiatives),
    cycleId: pinnedEntity('cycle', planned.cycles),
    assigneeUserId: pinnedText('assignee'),
    delegateUserId: pinnedText('delegate'),
    priority: pinnedText('priority'),
    labelIds: labelId != null ? [labelId] : undefined,
  };
  // The dialog reads an explicit undefined as "no assignee" / "no type".
  return Object.fromEntries(Object.entries(defaults).filter(([, v]) => v !== undefined));
}

// Fallback dot/bar color for a group or issue whose status/type has no color.
export const DEFAULT_COLOR = '#6b7280';

// Every display mode (Project, Table, Timeline, Calendar) takes the same props, so
// App can render whichever one is selected without special-casing. `settings`
// are the active project+view's display settings (see lib/viewSettings).
export interface WorkItemsViewProps {
  project: ProjectDetail;
  // The conditions the project's issues were filtered by. The layouts re-read them
  // to leave out the groups those conditions exclude (see buildGroups).
  filters: FilterSet;
  // Issues per column id before those filters are applied. A column's WIP limit is
  // measured against this rather than the cards on screen, so the limit means the
  // same thing to every viewer whatever they have filtered.
  columnCounts: Map<number, number>;
  // Custom field definitions applicable to this project (global + the project's
  // type-scoped fields). The Table view renders enabled ones as columns.
  customFields: CustomField[];
  settings: ViewSettings;
  // Persist a settings change (used by the flat project to store hidden columns in
  // the view's display). Routes through the view editor: on a saved view it
  // starts an edit (saved on Save), on the All tab it writes localStorage.
  onSettingsChange: (settings: ViewSettings) => void;
  onOpenIssue: (id: number) => void;
  onAddIssue: (defaults: NewIssueDefaults) => void;
  // When true the view is a public read-only share: dragging, adding issues and
  // multi-select are disabled, but opening an issue (onOpenIssue) still works.
  // Defaults to false (the normal authenticated board).
  readOnly?: boolean;
}

// Lookup maps over a project's reference data, built once per render and shared by
// every column/row/cell so each render is a map get instead of an array find.
export interface Maps {
  typeById: Map<number, IssueType>;
  labelById: Map<number, Label>;
  assigneeById: Map<string, Assignee>;
  columnById: Map<number, Column>;
}

export function buildMaps(project: ProjectDetail): Maps {
  return {
    typeById: new Map(project.issueTypes.map((t) => [t.id, t])),
    labelById: new Map(project.labels.map((l) => [l.id, l])),
    assigneeById: new Map(project.assignees.map((a) => [a.userId, a])),
    columnById: new Map(project.columns.map((c) => [c.id, c])),
  };
}

// The status color of a issue (its column's color), or the neutral default.
export function issueColor(issue: Issue, maps: Maps): string {
  return maps.columnById.get(issue.columnId)?.color ?? DEFAULT_COLOR;
}

// Returns a new array sorted by the chosen field. Missing values (no assignee,
// no due date, …) always sort last, regardless of direction, matching Linear.
// Ties fall back to the manual position so the order is stable. 'manual' returns
// the input unchanged (already position-ordered by the API).
export function sortIssues<T extends Issue>(issues: T[], sort: Sort, project: ProjectDetail): T[] {
  if (sort.field === 'manual') return issues;

  const columnIndex = new Map(project.columns.map((c, i) => [c.id, i]));
  const assigneeName = new Map(project.assignees.map((a) => [a.userId, a.name]));
  const typeName = new Map(project.issueTypes.map((t) => [t.id, t.name]));
  const dir = sort.dir === 'desc' ? -1 : 1;

  const numericField =
    sort.field === 'identifier' || sort.field === 'status' || sort.field === 'priority';

  const numKey = (t: Issue): number => {
    switch (sort.field) {
      case 'identifier':
        return Number(t.identifier.split('-').pop()) || 0;
      case 'status':
        return columnIndex.get(t.columnId) ?? Number.POSITIVE_INFINITY;
      case 'priority':
        return PRIORITY_RANK[t.priority ?? ''] ?? 4;
      default:
        return 0;
    }
  };

  const strKey = (t: Issue): string | null => {
    switch (sort.field) {
      case 'title':
        return t.title;
      case 'assignee':
        return t.assigneeUserId != null ? (assigneeName.get(t.assigneeUserId) ?? '') : null;
      case 'type':
        return t.typeId != null ? (typeName.get(t.typeId) ?? '') : null;
      case 'startDate':
        return t.startDate;
      case 'dueDate':
        return t.dueDate;
      case 'created':
        return t.createdAt;
      case 'updated':
        return t.updatedAt;
      default:
        return null;
    }
  };

  return [...issues].sort((a, b) => {
    let cmp: number;
    if (numericField) {
      cmp = numKey(a) - numKey(b);
    } else {
      const sa = strKey(a);
      const sb = strKey(b);
      if (!sa && !sb) cmp = 0;
      else if (!sa)
        return 1; // missing value last, unaffected by direction
      else if (!sb) return -1;
      else cmp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
    }
    if (cmp === 0) return a.position - b.position;
    return cmp * dir;
  });
}

// Positions for `count` issues dropped at `index` within `issuesInColumn`, in the
// order they should end up — spread evenly between their new neighbors, so
// inserting never requires renumbering the rest of the column (the same
// fractional-index trick Linear's sortOrder uses).
export function positionsAt(issuesInColumn: Issue[], index: number, count: number): number[] {
  const before = issuesInColumn[index - 1]?.position;
  const at = issuesInColumn[index]?.position;
  // Room to stand in for a missing neighbor, wide enough to keep the steps 1000
  // apart at either end of the column.
  const gap = 1000 * (count + 1);
  const lower = before ?? (at != null ? at - gap : 0);
  const upper = at ?? lower + gap;
  const step = (upper - lower) / (count + 1);
  return Array.from({ length: count }, (_, n) => lower + step * (n + 1));
}

// Groups a project's issues by column id, preserving each column's ordering. The
// map always has an (empty) entry for every column id in `columnIds`.
export function groupByColumn(columnIds: number[], issues: Issue[]): Map<number, Issue[]> {
  const byColumn = new Map<number, Issue[]>();
  for (const id of columnIds) byColumn.set(id, []);
  for (const issue of issues) byColumn.get(issue.columnId)?.push(issue);
  return byColumn;
}

// What a drop into a group writes: the patch of the built-in fields it stands for,
// and the member custom field values, one per grouping level that names such a
// field. A two-level grouping merges both levels (see mergeAssign).
export interface GroupAssign {
  patch: IssuePatch;
  fields: { fieldId: number; userId: string | null }[];
}

// The assign of a built-in grouping: a patch alone, no custom field to write.
const patchOnly = (patch: IssuePatch): GroupAssign => ({ patch, fields: [] });

// One Project column / Table section when grouping by the chosen field. `key` is a
// stable id (field-prefixed so different groupings never collide). `assign` is
// what reassigns a issue dropped into this group; null marks a group that takes no
// drop (the single 'none' group, a finished cycle).
export interface IssueGroup {
  key: string;
  name: string;
  color?: string;
  stateType?: StateType; // status groups, for the state icon
  assign: GroupAssign | null;
  // What a filter condition on the grouping field matches this group by: the
  // field's value, plus the status an initiative or a cycle is in. Read by
  // buildGroups to drop the groups an active filter makes unreachable.
  values: FilterValue[];
}

// The names a grouping needs beyond the project's own entities: the "No …" group
// of each nullable field, and the priority values. Supplied by useGroupLabels so
// they read in the reader's language.
export interface GroupLabels {
  noAssignee: string;
  noDelegate: string;
  noPriority: string;
  noType: string;
  noInitiative: string;
  noCycle: string;
  // The "No value" group of a member custom field, which has no name of its own.
  noMember: string;
  priority: (value: string) => string;
}

// The groups for a project under the chosen grouping field, in display order.
// Every nullable field gets a "No …" group so an unset issue still has a home
// (and a drop target that clears the field). `filters` drops the groups its own
// conditions exclude: a filter on the grouping field makes those unreachable — no
// issue can show there and a drop into one would hide the card it moved.
export function buildGroups(
  project: ProjectDetail,
  group: GroupField,
  labels: GroupLabels,
  filters: FilterSet,
): IssueGroup[] {
  return allowedGroups(allGroups(project, group, labels), group, filters);
}

function allGroups(project: ProjectDetail, group: GroupField, labels: GroupLabels): IssueGroup[] {
  if (isCustomFieldKey(group)) return memberGroups(project, group, labels);
  switch (group) {
    case 'status':
      return project.columns.map((c) => ({
        key: `c${c.id}`,
        name: c.name,
        color: c.color,
        stateType: c.stateType,
        assign: patchOnly({ columnId: c.id }),
        values: [c.id],
      }));
    case 'assignee':
      return [
        ...project.assignees
          .filter((a) => a.kind === 'member')
          .map((a) => ({
            key: `a${a.userId}`,
            name: a.name,
            assign: patchOnly({ assigneeUserId: a.userId }),
            values: [a.userId],
          })),
        {
          key: 'a-none',
          name: labels.noAssignee,
          assign: patchOnly({ assigneeUserId: null }),
          values: [null],
        },
      ];
    case 'delegate':
      return [
        ...project.assignees
          .filter((a) => a.kind === 'agent')
          .map((a) => ({
            key: `d${a.userId}`,
            name: a.name,
            assign: patchOnly({ delegateUserId: a.userId }),
            values: [a.userId],
          })),
        {
          key: 'd-none',
          name: labels.noDelegate,
          assign: patchOnly({ delegateUserId: null }),
          values: [null],
        },
      ];
    case 'priority':
      return [
        ...PRIORITY_ORDER.map((value) => ({
          key: `p${value}`,
          name: labels.priority(value),
          assign: patchOnly({ priority: value }),
          values: [value],
        })),
        {
          key: 'p-none',
          name: labels.noPriority,
          assign: patchOnly({ priority: null }),
          values: [null],
        },
      ];
    case 'type':
      return [
        ...project.issueTypes.map((t) => ({
          key: `t${t.id}`,
          name: t.name,
          color: t.color,
          assign: patchOnly({ typeId: t.id }),
          values: [t.id],
        })),
        { key: 't-none', name: labels.noType, assign: patchOnly({ typeId: null }), values: [null] },
      ];
    case 'initiative': {
      // Lanes come from the initiatives the loaded issues are linked to (each issue
      // carries its initiative). Initiatives with no issue on the board get no lane;
      // the full list is fetched on demand only where a picker needs it. "No
      // initiative" leads, then the lanes by status, by title within one status.
      const seen = new Map<number, InitiativeRef>();
      for (const issue of project.issues)
        if (issue.initiative) seen.set(issue.initiative.id, issue.initiative);
      const options = [...seen.values()].sort(compareByGroupOrder).map((i) => ({
        key: `i${i.id}`,
        name: i.title,
        assign: patchOnly({ initiativeId: i.id }),
        values: [i.id, statusValue(i.status)],
      }));
      return [
        {
          key: 'i-none',
          name: labels.noInitiative,
          assign: patchOnly({ initiativeId: null }),
          values: [null],
        },
        ...options,
      ];
    }
    case 'cycle': {
      // "No cycle" leads, then the cycles the board plans into: the upcoming ones
      // from the nearest to the last, then the running one (the API orders the list
      // by start date, so filtering by status keeps that order). Last come the
      // cycles only the issues name — the finished ones — so the work they carry
      // stays reachable; they take no drop, a finished cycle records what it
      // delivered. A public share carries no cycle list, so all of its columns come
      // from the issues.
      const namedByIssues = new Map<number, string>();
      for (const issue of project.issues)
        if (issue.cycle) namedByIssues.set(issue.cycle.id, issue.cycle.name);
      for (const c of project.plannedCycles) namedByIssues.delete(c.id);
      const upcomingFirst = [
        ...project.plannedCycles.filter((c) => c.status === 'upcoming'),
        ...project.plannedCycles.filter((c) => c.status !== 'upcoming'),
      ];
      return [
        {
          key: 'y-none',
          name: labels.noCycle,
          assign: patchOnly({ cycleId: null }),
          values: [null],
        },
        ...upcomingFirst.map((c) => ({
          key: `y${c.id}`,
          name: c.name,
          color: CYCLE_STATUS_META[c.status].color,
          assign: patchOnly({ cycleId: c.id }),
          values: [c.id, statusValue(c.status)],
        })),
        ...[...namedByIssues.entries()]
          .sort((a, b) => a[1].localeCompare(b[1]))
          .map(([id, name]) => ({
            key: `y${id}`,
            name,
            assign: null,
            values: [id, statusValue('completed')],
          })),
      ];
    }
    case 'none':
      return [{ key: 'all', name: '', assign: null, values: [] }];
  }
}

// The groups of a member custom field: the people and agents its scope offers, then
// the issues that hold none. A grouping naming a field the project no longer has
// keeps only that last group, which then holds every issue.
function memberGroups(
  project: ProjectDetail,
  group: CustomFieldKey,
  labels: GroupLabels,
): IssueGroup[] {
  const field = groupMemberField(group, project.customFields);
  const fieldId = customFieldId(group);
  const candidates = field ? memberCandidates(project.assignees, field.memberScope ?? 'all') : [];
  return [
    ...candidates.map((a) => ({
      key: memberGroupKey(fieldId, a.userId),
      name: a.name,
      assign: { patch: {}, fields: [{ fieldId, userId: a.userId }] },
      values: [a.userId],
    })),
    {
      key: memberGroupKey(fieldId, null),
      name: labels.noMember,
      assign: { patch: {}, fields: [{ fieldId, userId: null }] },
      values: [null],
    },
  ];
}

// The groups an active filter still lets an issue reach. Only the conditions on
// the grouping field itself narrow it: the rest decide which issues show, not
// which groups exist. Operators that read a date or a text never apply to a
// grouping field, so they leave the groups alone.
function allowedGroups(groups: IssueGroup[], group: GroupField, filters: FilterSet): IssueGroup[] {
  const conditions = filters.conditions.filter((c) => c.field === group && isEffectiveCondition(c));
  if (conditions.length === 0) return groups;
  return groups.filter((g) => conditions.every((c) => groupMatches(g, c)));
}

function groupMatches(group: IssueGroup, cond: FilterCondition): boolean {
  switch (cond.op) {
    case 'is':
      return group.values.some((v) => cond.values.includes(v));
    case 'is_not':
      return !group.values.some((v) => cond.values.includes(v));
    case 'is_set':
      return hasValue(group.values);
    case 'is_not_set':
      return !hasValue(group.values);
    default:
      return true;
  }
}

// The group key a issue belongs to under the chosen field — matches a key from
// buildGroups(project, group).
export function groupKeyOf(issue: Issue, group: GroupField): string {
  if (isCustomFieldKey(group)) {
    const fieldId = customFieldId(group);
    return memberGroupKey(fieldId, memberFieldValue(issue, fieldId));
  }
  switch (group) {
    case 'status':
      return `c${issue.columnId}`;
    case 'assignee':
      return issue.assigneeUserId != null ? `a${issue.assigneeUserId}` : 'a-none';
    case 'delegate':
      return issue.delegateUserId != null ? `d${issue.delegateUserId}` : 'd-none';
    case 'priority':
      return issue.priority ? `p${issue.priority}` : 'p-none';
    case 'type':
      return issue.typeId != null ? `t${issue.typeId}` : 't-none';
    case 'initiative':
      return issue.initiative != null ? `i${issue.initiative.id}` : 'i-none';
    case 'cycle':
      return issue.cycle != null ? `y${issue.cycle.id}` : 'y-none';
    case 'none':
      return 'all';
  }
}

// Issues bucketed by group key, preserving order. The map always has an (empty)
// entry for every group in `groups`; a issue whose key is not among them is
// dropped — `groups` comes from buildGroups under the same filters the issues
// passed, so that means a group the filter excludes.
export function groupIssues<T extends Issue>(
  groups: IssueGroup[],
  issues: T[],
  group: GroupField,
): Map<string, T[]> {
  const byGroup = new Map<string, T[]>();
  for (const g of groups) byGroup.set(g.key, []);
  for (const issue of issues) byGroup.get(groupKeyOf(issue, group))?.push(issue);
  return byGroup;
}

// Issues bucketed two levels deep: subgroup key -> group key -> issues, order
// preserved. Every subgroup/group cell from the inputs gets an (empty) entry, so
// callers can iterate `subgroups` x `groups` without missing-key checks. Used by
// the swimlane Project and the sub-sectioned Table.
export function nestIssues<T extends Issue>(
  subgroups: IssueGroup[],
  groups: IssueGroup[],
  issues: T[],
  subgroup: GroupField,
  group: GroupField,
): Map<string, Map<string, T[]>> {
  const out = new Map<string, Map<string, T[]>>();
  for (const sg of subgroups) {
    const inner = new Map<string, T[]>();
    for (const g of groups) inner.set(g.key, []);
    out.set(sg.key, inner);
  }
  for (const issue of issues) {
    out.get(groupKeyOf(issue, subgroup))?.get(groupKeyOf(issue, group))?.push(issue);
  }
  return out;
}

// The key of a sub-section in a two-level grouping: primary group key + sub-group
// key, so the same sub-group value under two different groups keeps its own
// collapse state and its own drop target.
export function subgroupKey(groupKey: string, subKey: string): string {
  return `${groupKey}::${subKey}`;
}

// The create-dialog defaults a group stands for: what a drop into it would assign,
// so an issue added inside the group lands in it. Its "No …" group prefills
// nothing — an unset field is what a new issue already has.
export function groupDefaults(assign: GroupAssign | null): NewIssueDefaults {
  return {
    ...assign?.patch,
    fieldValues: (assign?.fields ?? []).flatMap((f) =>
      f.userId != null ? [{ fieldId: f.fieldId, userId: f.userId }] : [],
    ),
  };
}

// The patch that reassigns a issue dropped into a two-level cell: the primary
// group's assign combined with the sub-group's assign. Either may be null (the
// 'none' group / a Table with no sub-grouping), in which case only the other
// applies; both null means the cell is not a drop target.
export function mergeAssign(a: GroupAssign | null, b: GroupAssign | null): GroupAssign | null {
  if (!a) return b;
  if (!b) return a;
  return { patch: { ...a.patch, ...b.patch }, fields: [...a.fields, ...b.fields] };
}
