import type { ProjectDetail, CustomField } from '@/lib/api';
import { PRIORITY_OPTIONS, STATE_TYPE_OPTIONS } from '@/utils/fieldOptions';
import type { FilterCondition, FilterOperator, FilterSet, FilterValue } from '@/utils/filters';
import { customFieldKey } from '@/utils/viewSettings';

// The kind of value a field holds, which decides its operators and value editor.
export type FieldKind = 'set' | 'date' | 'text' | 'number' | 'boolean';

export interface FieldOption {
  value: FilterValue;
  label: string;
  color?: string;
}

// One filterable field: how it is labeled, what kind of value it holds, and (for
// set fields) the choices. `field` is the persisted key (a builtin name or
// `cf:<id>`).
export interface FieldSpec {
  field: string;
  label: string;
  kind: FieldKind;
  options?: FieldOption[];
}

// Operators available for each field kind, in menu order.
export const OPERATORS_BY_KIND: Record<FieldKind, FilterOperator[]> = {
  set: ['is', 'is_not'],
  date: ['before', 'after', 'is_set', 'is_not_set'],
  text: ['contains', 'not_contains', 'is_set', 'is_not_set'],
  number: ['is', 'is_not', 'is_set', 'is_not_set'],
  boolean: ['is'],
};

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  is: 'is',
  is_not: 'is not',
  before: 'before',
  after: 'after',
  is_set: 'is set',
  is_not_set: 'is not set',
  contains: 'contains',
  not_contains: 'does not contain',
};

export const BOOLEAN_OPTIONS: FieldOption[] = [
  { value: true, label: 'True' },
  { value: false, label: 'False' },
];

// Maps a custom field type to a filter field kind. select/multi_select are set
// fields over their options; the scalar types map to their editors.
function customFieldKind(field: CustomField): FieldKind {
  switch (field.fieldType) {
    case 'select':
    case 'multi_select':
      return 'set';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    default:
      return 'text'; // text, markdown
  }
}

// The full catalog of filterable fields for a project: builtins plus every custom
// field. Recomputed when the project or its custom fields change.
export function buildFieldSpecs(project: ProjectDetail, customFields: CustomField[]): FieldSpec[] {
  const specs: FieldSpec[] = [
    {
      field: 'status',
      label: 'State',
      kind: 'set',
      options: project.columns.map((c) => ({ value: c.id, label: c.name, color: c.color })),
    },
    { field: 'statusType', label: 'State type', kind: 'set', options: STATE_TYPE_OPTIONS },
    {
      field: 'assignee',
      label: 'Assignee',
      kind: 'set',
      options: [
        ...project.assignees
          .filter((a) => a.kind === 'member')
          .map((a) => ({ value: a.userId, label: a.name })),
        { value: null, label: 'No assignee' },
      ],
    },
    {
      field: 'delegate',
      label: 'Delegate',
      kind: 'set',
      options: [
        ...project.assignees
          .filter((a) => a.kind === 'agent')
          .map((a) => ({ value: a.userId, label: a.name })),
        { value: null, label: 'No delegate' },
      ],
    },
    { field: 'priority', label: 'Priority', kind: 'set', options: PRIORITY_OPTIONS },
    {
      field: 'type',
      label: 'Type',
      kind: 'set',
      options: [
        ...project.issueTypes.map((t) => ({ value: t.id, label: t.name, color: t.color })),
        { value: null, label: 'No type' },
      ],
    },
    {
      field: 'labels',
      label: 'Labels',
      kind: 'set',
      options: project.labels.map((l) => ({ value: l.id, label: l.name, color: l.color })),
    },
    { field: 'dueDate', label: 'Due date', kind: 'date' },
    { field: 'startDate', label: 'Start date', kind: 'date' },
    { field: 'created', label: 'Created', kind: 'date' },
    { field: 'updated', label: 'Updated', kind: 'date' },
  ];
  for (const f of customFields) {
    const kind = customFieldKind(f);
    specs.push({
      field: customFieldKey(f.id),
      label: f.name,
      kind,
      options:
        kind === 'set'
          ? f.options.map((o) => ({ value: o.id, label: o.value, color: o.color }))
          : undefined,
    });
  }
  return specs;
}

// A fresh condition for a newly picked field, with the kind's first operator and
// no values, so it is inert (see isEffectiveCondition) until the user fills it in.
export function newCondition(spec: FieldSpec): FilterCondition {
  return {
    id: crypto.randomUUID(),
    field: spec.field,
    op: OPERATORS_BY_KIND[spec.kind][0],
    values: [],
  };
}

// Short display of a condition's chosen values for the pill.
export function valuesLabel(spec: FieldSpec, cond: FilterCondition): string {
  if (cond.op === 'is_set' || cond.op === 'is_not_set') return '';
  if (cond.values.length === 0) return '…';
  if (spec.kind === 'set' || spec.kind === 'boolean') {
    const opts = spec.kind === 'boolean' ? BOOLEAN_OPTIONS : (spec.options ?? []);
    const labels = cond.values.map((v) => opts.find((o) => o.value === v)?.label ?? String(v));
    return labels.length <= 2 ? labels.join(', ') : `${labels.length} selected`;
  }
  return String(cond.values[0] ?? '');
}

// Short human-readable labels for the effective conditions of a filter set, e.g.
// ["State is Done", "Priority is not Low"]. Half-built conditions (no values on a
// value-based operator) and conditions on unknown fields are skipped.
export function describeConditions(
  filters: FilterSet | null | undefined,
  project: ProjectDetail,
  customFields: CustomField[],
): string[] {
  if (!filters) return [];
  const byField = new Map(buildFieldSpecs(project, customFields).map((s) => [s.field, s]));
  const out: string[] = [];
  for (const cond of filters.conditions) {
    const spec = byField.get(cond.field);
    if (!spec) continue;
    const presence = cond.op === 'is_set' || cond.op === 'is_not_set';
    if (!presence && cond.values.length === 0) continue;
    const op = OPERATOR_LABELS[cond.op];
    out.push(presence ? `${spec.label} ${op}` : `${spec.label} ${op} ${valuesLabel(spec, cond)}`);
  }
  return out;
}
