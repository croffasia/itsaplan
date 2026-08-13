import type { FilterOperator, FilterValue } from '@/utils/filters';

// The kind of value a field holds, which decides its operators and value editor.
export type FieldKind = 'set' | 'date' | 'text' | 'number' | 'boolean';

export interface FieldOption {
  value: FilterValue;
  label: string;
  color?: string;
  // Draws a rule above this option, which splits a list into groups — the values
  // that stand for a whole status of the cycle or the initiative, then the ones
  // that name a single one.
  dividerBefore?: boolean;
}

// One filterable field: how it is labeled, what kind of value it holds, and (for
// set fields) the choices. `field` is the persisted key (a builtin name or
// `cf:<id>`). Built by useFilterFields, which names the builtins in the reader's
// language.
export interface FieldSpec {
  field: string;
  label: string;
  kind: FieldKind;
  options?: FieldOption[];
}

// Operators available for each field kind, in menu order. The name of an
// operator is a message under `filters.operators`.
export const OPERATORS_BY_KIND: Record<FieldKind, FilterOperator[]> = {
  set: ['is', 'is_not'],
  date: ['before', 'after', 'is_set', 'is_not_set'],
  text: ['contains', 'not_contains', 'is_set', 'is_not_set'],
  number: ['is', 'is_not', 'is_set', 'is_not_set'],
  boolean: ['is'],
};

// The builtin filterable fields, in menu order. Their options come from the
// project (see useFilterFields); the custom fields follow them.
export const BUILTIN_FILTER_FIELDS = [
  'status',
  'statusType',
  'assignee',
  'delegate',
  'priority',
  'type',
  'initiative',
  'cycle',
  'labels',
  'dueDate',
  'startDate',
  'created',
  'updated',
] as const;

export type BuiltinFilterField = (typeof BUILTIN_FILTER_FIELDS)[number];
