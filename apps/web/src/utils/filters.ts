// Client-side filter model and matching engine for the project views. A view's
// filters are stored in the DB (kanban_views.filters) as a FilterSet; the same
// set is applied to every layout (Project, Table, Timeline, Calendar) before the
// issues are handed to the view. The server never inspects this shape.

import type { StateType } from '@/lib/api/endpoints/columns';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { dayKey } from '@/utils/dates';
import { BUILTIN_FILTER_FIELDS, OPERATORS_BY_KIND } from '@/utils/filterFields';
import { uuid } from '@/utils/uuid';
import { isCustomFieldKey } from '@/utils/viewSettings';

// The built-in fields a condition can target. Custom fields are targeted with
// the string `cf:<fieldId>` (see customFieldKey / parseCustomFieldKey).
export type BuiltinFilterField =
  | 'status' // the issue's column id
  | 'statusType' // the column's state type (backlog/unstarted/…)
  | 'assignee' // assignee id, or null for "no assignee"
  | 'delegate' // delegate agent id, or null for "no delegate"
  | 'priority' // priority string, or null for "no priority"
  | 'type' // issue type id, or null for "no type"
  | 'initiative' // initiative id or `status:<status>`, or null for "no initiative"
  | 'cycle' // cycle id or `status:<status>`, or null for "no cycle"
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

// The value that stands for a whole status of the initiative or the cycle an issue
// is planned under, instead of one of them by id: "the running cycle", "the active
// initiatives". A saved view built on it follows the cycles as they roll over. An
// issue matches both its own id and the status it is in.
export function statusValue(status: string): string {
  return `status:${status}`;
}

export function parseStatusValue(value: FilterValue): string | null {
  return typeof value === 'string' && value.startsWith('status:') ? value.slice(7) : null;
}

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
// `values` is checked for being a list because the whole set comes from a jsonb
// blob the server stores without inspecting it.
export function isEffectiveCondition(cond: FilterCondition): boolean {
  if (cond.op === 'is_set' || cond.op === 'is_not_set') return true;
  return Array.isArray(cond.values) && cond.values.length > 0;
}

const BUILTIN_FIELDS = new Set<unknown>(BUILTIN_FILTER_FIELDS);
const OPERATORS = new Set<unknown>(Object.values(OPERATORS_BY_KIND).flat());

function isFilterValue(value: unknown): value is FilterValue {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isFilterCondition(value: unknown): value is FilterCondition {
  const c = value as Partial<Record<keyof FilterCondition, unknown>> | null;
  return (
    typeof c?.id === 'string' &&
    typeof c.field === 'string' &&
    (BUILTIN_FIELDS.has(c.field) || isCustomFieldKey(c.field)) &&
    OPERATORS.has(c.op) &&
    Array.isArray(c.values) &&
    c.values.every(isFilterValue)
  );
}

// A filter set read back from browser storage, which an older version or a hand edit
// may have left in any shape. A condition the filter bar or the matching could not
// read is dropped; anything that is not a set reads as no filter.
export function toFilterSet(raw: unknown): FilterSet {
  const conditions = (raw as { conditions?: unknown } | null | undefined)?.conditions;
  return Array.isArray(conditions)
    ? { conditions: conditions.filter(isFilterCondition) }
    : EMPTY_FILTER_SET;
}

// The set without its conditions on a custom field missing from `fields`. A stored
// condition outlives a field deleted since: it would match no issue, and the filter
// bar has no pill to remove it from. The same set comes back when nothing is dropped.
export function withExistingFields(set: FilterSet, fields: readonly { id: number }[]): FilterSet {
  const ids = new Set(fields.map((f) => f.id));
  const kept = set.conditions.filter((c) => {
    const id = parseCustomFieldKey(c.field);
    return id == null || ids.has(id);
  });
  return kept.length === set.conditions.length ? set : { conditions: kept };
}

// Normalizes any date the store returns to a "YYYY-MM-DD" day for comparison:
// due/start dates are already that; a moment (created/updated, a datetime custom
// field) is taken by the day it falls on in the user's zone, which is the day the
// views render it as. String comparison on this format orders correctly.
function toDay(value: string | null): string | null {
  if (!value) return null;
  return value.length <= 10 ? value : dayKey(value);
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
    case 'initiative':
      return issue.initiative
        ? [issue.initiative.id, statusValue(issue.initiative.status)]
        : [null];
    case 'cycle':
      return issue.cycle ? [issue.cycle.id, statusValue(issue.cycle.status)] : [null];
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

// Whether a set of values counts as present for is_set/is_not_set: a null or an
// empty string is what an unset field reads as.
export function hasValue(values: FilterValue[]): boolean {
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
// empty or all-empty set returns the input unchanged. Generic over the issue
// shape so a board issue keeps its relations through the filter.
export function applyFilters<T extends Issue>(
  issues: T[],
  filters: FilterSet | null | undefined,
  project: ProjectDetail,
): T[] {
  if (!isActiveFilterSet(filters)) return issues;
  const columnStateType = new Map(project.columns.map((c) => [c.id, c.stateType]));
  const active = filters!.conditions.filter(isEffectiveCondition);
  return issues.filter((t) => active.every((cond) => matchCondition(t, cond, columnStateType)));
}

// How many of the issues hold each value of a set or boolean field, counted the way
// a condition matches them: an issue in the active cycle counts for that cycle and
// for "Active cycle", and an issue with no assignee counts for null.
export function countIssuesByValue(
  issues: Issue[],
  field: string,
  project: ProjectDetail,
): Map<FilterValue, number> {
  const columnStateType = new Map(project.columns.map((c) => [c.id, c.stateType]));
  const cfId = parseCustomFieldKey(field);
  const counts = new Map<FilterValue, number>();
  for (const issue of issues) {
    const values =
      cfId != null
        ? customFieldValues(issue, cfId)
        : builtinSetValues(issue, field as BuiltinFilterField, columnStateType);
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

// The field's first "is" condition, which a value picked for the field joins.
export function fieldCondition(filters: FilterSet, field: string): FilterCondition | undefined {
  return filters.conditions.find((c) => c.field === field && c.op === 'is');
}

// The set with "field is value": the value joins the field's first "is" condition,
// or a new condition holds it. Also returns that condition's id.
export function withFieldValue(
  filters: FilterSet,
  field: string,
  value: FilterValue,
): { filters: FilterSet; id: string } {
  const existing = fieldCondition(filters, field);
  if (!existing) {
    const added: FilterCondition = { id: uuid(), field, op: 'is', values: [value] };
    return { filters: { conditions: [...filters.conditions, added] }, id: added.id };
  }
  const values = existing.values.includes(value) ? existing.values : [...existing.values, value];
  return {
    filters: {
      conditions: filters.conditions.map((c) => (c.id === existing.id ? { ...c, values } : c)),
    },
    id: existing.id,
  };
}

// The set with `value` added to the condition `id`, or taken out of it. A condition
// left with no value is dropped, so no empty condition stays behind.
export function toggleConditionValue(
  filters: FilterSet,
  id: string,
  value: FilterValue,
): FilterSet {
  const conditions: FilterCondition[] = [];
  for (const c of filters.conditions) {
    if (c.id !== id) {
      conditions.push(c);
      continue;
    }
    const values = c.values.includes(value)
      ? c.values.filter((v) => v !== value)
      : [...c.values, value];
    if (values.length > 0) conditions.push({ ...c, values });
  }
  return { conditions };
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
