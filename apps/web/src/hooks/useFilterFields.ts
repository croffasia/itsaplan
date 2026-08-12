'use client';

import { useTranslations } from 'next-intl';
import type { CustomField, ProjectDetail } from '@/lib/api';
import { formatDate } from '@/utils/dates';
import { PRIORITY_FILTER_VALUES, STATE_TYPES } from '@/utils/fieldOptions';
import type { FilterCondition, FilterSet, FilterValue } from '@/utils/filters';
import {
  OPERATORS_BY_KIND,
  type FieldKind,
  type FieldOption,
  type FieldSpec,
} from '@/utils/filterFields';
import { customFieldKey } from '@/utils/viewSettings';
import { usePriorityLabel } from '@/hooks/usePriorityLabel';
import { byKey } from '@/utils/messageKey';

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

// The filter vocabulary in the reader's language: the field catalog of a project,
// the operator names, the boolean choices, and the short renderings a pill and a
// saved action show.
export function useFilterFields() {
  const t = useTranslations('filters');
  const operator = byKey(useTranslations('filters.operators'));
  const stateType = byKey(useTranslations('display.stateTypes'));
  const priorityLabel = usePriorityLabel();

  const booleanOptions: FieldOption[] = [
    { value: true, label: t('boolean.true') },
    { value: false, label: t('boolean.false') },
  ];

  const operatorLabel = (op: FilterCondition['op']) => operator(op);

  // The full catalog of filterable fields for a project: builtins plus every
  // custom field.
  const fieldSpecs = (project: ProjectDetail, customFields: CustomField[]): FieldSpec[] => {
    const specs: FieldSpec[] = [
      {
        field: 'status',
        label: t('fields.status'),
        kind: 'set',
        options: project.columns.map((c) => ({ value: c.id, label: c.name, color: c.color })),
      },
      {
        field: 'statusType',
        label: t('fields.statusType'),
        kind: 'set',
        options: STATE_TYPES.map((value) => ({ value, label: stateType(value) })),
      },
      {
        field: 'assignee',
        label: t('fields.assignee'),
        kind: 'set',
        options: [
          ...project.assignees
            .filter((a) => a.kind === 'member')
            .map((a) => ({ value: a.userId, label: a.name })),
          { value: null, label: t('unset.assignee') },
        ],
      },
      {
        field: 'delegate',
        label: t('fields.delegate'),
        kind: 'set',
        options: [
          ...project.assignees
            .filter((a) => a.kind === 'agent')
            .map((a) => ({ value: a.userId, label: a.name })),
          { value: null, label: t('unset.delegate') },
        ],
      },
      {
        field: 'priority',
        label: t('fields.priority'),
        kind: 'set',
        options: PRIORITY_FILTER_VALUES.map((value) => ({
          value,
          label: priorityLabel(value),
        })),
      },
      {
        field: 'type',
        label: t('fields.type'),
        kind: 'set',
        options: [
          ...project.issueTypes.map((ty) => ({ value: ty.id, label: ty.name, color: ty.color })),
          { value: null, label: t('unset.type') },
        ],
      },
      {
        field: 'labels',
        label: t('fields.labels'),
        kind: 'set',
        options: project.labels.map((l) => ({ value: l.id, label: l.name, color: l.color })),
      },
      { field: 'dueDate', label: t('fields.dueDate'), kind: 'date' },
      { field: 'startDate', label: t('fields.startDate'), kind: 'date' },
      { field: 'created', label: t('fields.created'), kind: 'date' },
      { field: 'updated', label: t('fields.updated'), kind: 'date' },
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
  };

  // Short display of a condition's chosen values for the pill.
  const valuesLabel = (spec: FieldSpec, cond: FilterCondition): string => {
    if (cond.op === 'is_set' || cond.op === 'is_not_set') return '';
    if (cond.values.length === 0) return '…';
    if (spec.kind === 'set' || spec.kind === 'boolean') {
      const opts = spec.kind === 'boolean' ? booleanOptions : (spec.options ?? []);
      const labels = cond.values.map(
        (v: FilterValue) => opts.find((o) => o.value === v)?.label ?? String(v),
      );
      return labels.length <= 2 ? labels.join(', ') : t('selected', { count: labels.length });
    }
    if (spec.kind === 'date' && typeof cond.values[0] === 'string') {
      return formatDate(cond.values[0]);
    }
    return String(cond.values[0] ?? '');
  };

  // Short readable labels for the effective conditions of a filter set, e.g.
  // ["State is Done", "Priority is not Low"]. Half-built conditions (no values on
  // a value-based operator) and conditions on unknown fields are skipped.
  const describeConditions = (
    filters: FilterSet | null | undefined,
    project: ProjectDetail,
    customFields: CustomField[],
  ): string[] => {
    if (!filters) return [];
    const byField = new Map(fieldSpecs(project, customFields).map((s) => [s.field, s]));
    const out: string[] = [];
    for (const cond of filters.conditions) {
      const spec = byField.get(cond.field);
      if (!spec) continue;
      const presence = cond.op === 'is_set' || cond.op === 'is_not_set';
      if (!presence && cond.values.length === 0) continue;
      const op = operatorLabel(cond.op);
      out.push(presence ? `${spec.label} ${op}` : `${spec.label} ${op} ${valuesLabel(spec, cond)}`);
    }
    return out;
  };

  return { fieldSpecs, operatorLabel, booleanOptions, valuesLabel, describeConditions };
}
