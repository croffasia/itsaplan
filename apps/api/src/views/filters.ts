import type { IssueRow } from '../issues/store';
import type { ColumnRow } from '../columns/store';

// Server-side copy of the view filter engine. The web app (utils/filters.ts) stores
// a view's filters as a FilterSet and applies them client-side to every layout; the
// server never inspected the shape. Public sharing needs it on the server: a shared
// view must return only the issues its filters match, not the whole project. Keep
// the matching semantics in sync with the web util.

type FilterField =
  | 'status'
  | 'statusType'
  | 'assignee'
  | 'delegate'
  | 'priority'
  | 'type'
  | 'labels'
  | 'dueDate'
  | 'startDate'
  | 'created'
  | 'updated';

type FilterOperator =
  'is' | 'is_not' | 'before' | 'after' | 'is_set' | 'is_not_set' | 'contains' | 'not_contains';

type FilterValue = string | number | boolean | null;

interface FilterCondition {
  field: string;
  op: FilterOperator;
  values: FilterValue[];
}

interface FilterSet {
  conditions: FilterCondition[];
}

const DATE_FIELDS: FilterField[] = ['dueDate', 'startDate', 'created', 'updated'];

function parseCustomFieldKey(field: string): number | null {
  return field.startsWith('cf:') ? Number(field.slice(3)) : null;
}

// A condition constrains the result only when it has a value (presence operators
// need none), so a half-built condition does not hide everything.
function isEffectiveCondition(cond: FilterCondition): boolean {
  if (cond.op === 'is_set' || cond.op === 'is_not_set') return true;
  return cond.values.length > 0;
}

// Coerces the persisted jsonb into a FilterSet, dropping anything malformed.
function toFilterSet(raw: unknown): FilterSet {
  if (!raw || typeof raw !== 'object') return { conditions: [] };
  const conditions = (raw as { conditions?: unknown }).conditions;
  if (!Array.isArray(conditions)) return { conditions: [] };
  const valid = conditions.filter(
    (c): c is FilterCondition =>
      !!c && typeof c === 'object' && typeof (c as FilterCondition).field === 'string',
  );
  return { conditions: valid };
}

function toDay(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function builtinSetValues(
  issue: IssueRow,
  field: FilterField,
  columnStateType: Map<number, string>,
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

function builtinDate(issue: IssueRow, field: FilterField): string | null {
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

function customFieldValues(issue: IssueRow, fieldId: number): FilterValue[] {
  const entry = issue.fieldValues.find((v) => v.fieldId === fieldId);
  if (!entry) return [null];
  if (entry.optionIds.length) return entry.optionIds;
  return [entry.value];
}

function customFieldScalar(issue: IssueRow, fieldId: number): FilterValue {
  const entry = issue.fieldValues.find((v) => v.fieldId === fieldId);
  return entry ? entry.value : null;
}

function hasValue(values: FilterValue[]): boolean {
  return values.some((v) => v !== null && v !== '');
}

function matchCondition(
  issue: IssueRow,
  cond: FilterCondition,
  columnStateType: Map<number, string>,
): boolean {
  const cfId = parseCustomFieldKey(cond.field);
  const isDate = cfId == null && DATE_FIELDS.includes(cond.field as FilterField);

  if (cond.op === 'before' || cond.op === 'after') {
    const raw =
      cfId != null
        ? (customFieldScalar(issue, cfId) as string | null)
        : builtinDate(issue, cond.field as FilterField);
    const day = toDay(typeof raw === 'string' ? raw : null);
    const target = typeof cond.values[0] === 'string' ? cond.values[0] : null;
    if (!day || !target) return false;
    return cond.op === 'before' ? day < target : day > target;
  }

  if (cond.op === 'is_set' || cond.op === 'is_not_set') {
    let present: boolean;
    if (cfId != null) present = hasValue(customFieldValues(issue, cfId));
    else if (isDate) present = builtinDate(issue, cond.field as FilterField) != null;
    else present = hasValue(builtinSetValues(issue, cond.field as FilterField, columnStateType));
    return cond.op === 'is_set' ? present : !present;
  }

  if (cond.op === 'contains' || cond.op === 'not_contains') {
    const raw = cfId != null ? customFieldScalar(issue, cfId) : null;
    const text = typeof raw === 'string' ? raw.toLowerCase() : '';
    const needle = typeof cond.values[0] === 'string' ? cond.values[0].toLowerCase() : '';
    const has = needle !== '' && text.includes(needle);
    return cond.op === 'contains' ? has : !has;
  }

  // is / is_not — set membership.
  const issueValues =
    cfId != null
      ? customFieldValues(issue, cfId)
      : builtinSetValues(issue, cond.field as FilterField, columnStateType);
  const overlaps = cond.values.some((cv) => issueValues.includes(cv));
  return cond.op === 'is' ? overlaps : !overlaps;
}

// The issues that satisfy every effective condition. An empty or all-empty set
// returns the input unchanged.
export function applyFilters(
  issues: IssueRow[],
  rawFilters: unknown,
  columns: ColumnRow[],
): IssueRow[] {
  const active = toFilterSet(rawFilters).conditions.filter(isEffectiveCondition);
  if (active.length === 0) return issues;
  const columnStateType = new Map(columns.map((c) => [c.id, c.stateType]));
  return issues.filter((issue) =>
    active.every((cond) => matchCondition(issue, cond, columnStateType)),
  );
}
