// Client-side filter model and matching engine for the project views. A view's
// filters are stored in the DB (kanban_views.filters) as a FilterSet; the same
// set is applied to every layout (Project, Table, Timeline, Calendar) before the
// issues are handed to the view. The server never inspects this shape.

import type { ProjectDetail, StateType, Issue } from '@/lib/api';

// The built-in fields a condition can target. Custom fields are targeted with
// the string `cf:<fieldId>` (see customFieldKey / parseCustomFieldKey).
export type BuiltinFilterField =
  | 'status' // the issue's column id
  | 'statusType' // the column's state type (backlog/unstarted/…)
  | 'assignee' // assignee id, or null for "no assignee"
  | 'delegate' // delegate agent id, or null for "no delegate"
  | 'priority' // priority string, or null for "no priority"
  | 'type' // issue type id, or null for "no type"
  | 'labels' // label ids (a issue has any/none of the chosen ones)
  | 'dueDate'
  | 'startDate'
  | 'created'
  | 'updated';

// Operators, grouped by the field kinds they apply to:
// - is / is_not: set membership (a value in / not in the chosen set)
// - before / after: date comparison (single date value)
// - is_set / is_not_set: presence (no value needed)
// - contains / not_contains: substring match on text (single string value)
export type FilterOperator =
  'is' | 'is_not' | 'before' | 'after' | 'is_set' | 'is_not_set' | 'contains' | 'not_contains';

export type FilterValue = string | number | boolean | null;

export interface FilterCondition {
  // Client-only stable key for React lists; not persisted meaningfully.
  id: string;
  // A BuiltinFilterField or `cf:<fieldId>`.
  field: string;
  op: FilterOperator;
  // The chosen values (OR-ed within the condition). Empty for is_set/is_not_set.
  values: FilterValue[];
}

export interface FilterSet {
  conditions: FilterCondition[];
}

export const EMPTY_FILTER_SET: FilterSet = { conditions: [] };

export function parseCustomFieldKey(field: string): number | null {
  return field.startsWith('cf:') ? Number(field.slice(3)) : null;
}

// A FilterSet is only "active" (narrows the project) when it has at least one
// condition. A condition with an empty value set for a value-based operator is
// ignored, so a half-built condition in the UI does not hide everything.
export function isActiveFilterSet(filters: FilterSet | null | undefined): boolean {
  return !!filters && filters.conditions.some(isEffectiveCondition);
}

// Whether a condition actually constrains the result. Presence operators
// (is_set/is_not_set) need no value; every other operator needs at least one.
function isEffectiveCondition(cond: FilterCondition): boolean {
  if (cond.op === 'is_set' || cond.op === 'is_not_set') return true;
  return cond.values.length > 0;
}

// Normalizes any date the store returns to a "YYYY-MM-DD" day for comparison:
// due/start dates are already that; created/updated are ISO datetimes, so the
// date part is sliced off. String comparison on this format orders correctly.
function toDay(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

// The issue's value(s) for a built-in set-membership field, as an array so
// multi-valued fields (labels) and single-valued ones share one code path. A
// missing value is represented as [null] so an "is No assignee" condition can
// match it.
function builtinSetValues(
  issue: Issue,
  field: BuiltinFilterField,
  columnStateType: Map<number, StateType>,
): FilterValue[] {
  switch (field) {
    case 'status':
      return [issue.columnId];
    case 'statusType':
      return [columnStateType.get(issue.columnId) ?? null];
    case 'assignee':
      return [issue.assigneeUserId];
    case 'delegate':
      return [issue.delegateUserId];
    case 'priority':
      return [issue.priority];
    case 'type':
      return [issue.typeId];
    case 'labels':
      return issue.labelIds.length ? issue.labelIds : [null];
    default:
      return [];
  }
}

// The issue's raw date string for a built-in date field (or null if unset).
function builtinDate(issue: Issue, field: BuiltinFilterField): string | null {
  switch (field) {
    case 'dueDate':
      return issue.dueDate;
    case 'startDate':
      return issue.startDate;
    case 'created':
      return issue.createdAt;
    case 'updated':
      return issue.updatedAt;
    default:
      return null;
  }
}

const DATE_FIELDS: BuiltinFilterField[] = ['dueDate', 'startDate', 'created', 'updated'];

// A custom field's stored value(s) on a issue: its selected option ids if any,
// otherwise its scalar value. [null] when nothing is set, so presence and
// "No value" style conditions work.
function customFieldValues(issue: Issue, fieldId: number): FilterValue[] {
  const entry = issue.fieldValues?.find((v) => v.fieldId === fieldId);
  if (!entry) return [null];
  if (entry.optionIds.length) return entry.optionIds;
  return [entry.value];
}

function customFieldScalar(issue: Issue, fieldId: number): FilterValue {
  const entry = issue.fieldValues?.find((v) => v.fieldId === fieldId);
  return entry ? entry.value : null;
}

function hasValue(values: FilterValue[]): boolean {
  return values.some((v) => v !== null && v !== '');
}

// Whether one issue satisfies one condition.
function matchCondition(
  issue: Issue,
  cond: FilterCondition,
  columnStateType: Map<number, StateType>,
): boolean {
  const cfId = parseCustomFieldKey(cond.field);
  const isDate = cfId == null && DATE_FIELDS.includes(cond.field as BuiltinFilterField);

  // Date operators (built-in date fields; custom date fields also route here
  // when the UI picks before/after/is_set on them).
  if (cond.op === 'before' || cond.op === 'after') {
    const raw =
      cfId != null
        ? (customFieldScalar(issue, cfId) as string | null)
        : builtinDate(issue, cond.field as BuiltinFilterField);
    const day = toDay(typeof raw === 'string' ? raw : null);
    const target = typeof cond.values[0] === 'string' ? (cond.values[0] as string) : null;
    if (!day || !target) return false;
    return cond.op === 'before' ? day < target : day > target;
  }

  if (cond.op === 'is_set' || cond.op === 'is_not_set') {
    let present: boolean;
    if (cfId != null) present = hasValue(customFieldValues(issue, cfId));
    else if (isDate) present = builtinDate(issue, cond.field as BuiltinFilterField) != null;
    else
      present = hasValue(
        builtinSetValues(issue, cond.field as BuiltinFilterField, columnStateType),
      );
    return cond.op === 'is_set' ? present : !present;
  }

  if (cond.op === 'contains' || cond.op === 'not_contains') {
    const raw = cfId != null ? customFieldScalar(issue, cfId) : null;
    const text = typeof raw === 'string' ? raw.toLowerCase() : '';
    const needle =
      typeof cond.values[0] === 'string' ? (cond.values[0] as string).toLowerCase() : '';
    const has = needle !== '' && text.includes(needle);
    return cond.op === 'contains' ? has : !has;
  }

  // is / is_not — set membership.
  const issueValues =
    cfId != null
      ? customFieldValues(issue, cfId)
      : builtinSetValues(issue, cond.field as BuiltinFilterField, columnStateType);
  const overlaps = cond.values.some((cv) => issueValues.includes(cv));
  return cond.op === 'is' ? overlaps : !overlaps;
}

// Returns the issues that satisfy every effective condition in the set. An
// empty or all-empty set returns the input unchanged.
export function applyFilters(
  issues: Issue[],
  filters: FilterSet | null | undefined,
  project: ProjectDetail,
): Issue[] {
  if (!isActiveFilterSet(filters)) return issues;
  const columnStateType = new Map(project.columns.map((c) => [c.id, c.stateType]));
  const active = filters!.conditions.filter(isEffectiveCondition);
  return issues.filter((t) => active.every((cond) => matchCondition(t, cond, columnStateType)));
}

// Whether one issue satisfies every effective condition in the set. An empty or
// all-empty set matches every issue (used for a manual action that is always
// available). Half-built conditions (a value-based operator with no values) are
// ignored, matching applyFilters.
export function matchesFilterSet(
  issue: Issue,
  filters: FilterSet | null | undefined,
  project: ProjectDetail,
): boolean {
  if (!isActiveFilterSet(filters)) return true;
  const columnStateType = new Map(project.columns.map((c) => [c.id, c.stateType]));
  return filters!.conditions
    .filter(isEffectiveCondition)
    .every((cond) => matchCondition(issue, cond, columnStateType));
}
