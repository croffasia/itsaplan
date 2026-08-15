'use client';

import { useTranslations } from 'next-intl';
import type {
  CustomField,
  InitiativeOption,
  InitiativeRef,
  MemberScope,
  ProjectDetail,
} from '@/lib/api';
import { useInitiativeOptionsQuery } from '@/services/initiatives.service';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import { formatDate } from '@/utils/dates';
import {
  CYCLE_FILTER_STATUSES,
  INITIATIVE_FILTER_STATUSES,
  PRIORITY_FILTER_VALUES,
  STATE_TYPES,
} from '@/utils/fieldOptions';
import { compareByGroupOrder } from '@/utils/initiativeMeta';
import { projectFeatures } from '@/utils/projectFeatures';
import { uuid } from '@/utils/uuid';
import {
  statusValue,
  type FilterCondition,
  type FilterSet,
  type FilterValue,
} from '@/utils/filters';
import {
  OPERATORS_BY_KIND,
  type FieldKind,
  type FieldOption,
  type FieldSpec,
} from '@/utils/filterFields';
import { customFieldKey, isFieldEnabled, type GroupField } from '@/utils/viewSettings';
import { memberCandidates } from '@/utils/memberFields';
import { usePriorityLabel } from '@/hooks/usePriorityLabel';
import { byKey } from '@/utils/messageKey';

// Maps a custom field type to a filter field kind. select/multi_select are set
// fields over their options, member is a set over the project's people and agents;
// the scalar types map to their editors.
function customFieldKind(field: CustomField): FieldKind {
  switch (field.fieldType) {
    case 'select':
    case 'multi_select':
    case 'member':
      return 'set';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'datetime':
    case 'datetime_range':
      return 'date';
    default:
      return 'text'; // text, markdown
  }
}

// The initiatives to offer: the ones an issue can be linked to, so a view can be
// set up for an initiative that carries no issue yet, then the closed ones only the
// issues name, ordered by status and title, so the work under them stays filterable.
function initiativeOptions(project: ProjectDetail, linkable: InitiativeOption[]): FieldOption[] {
  const namedByIssues = new Map<number, InitiativeRef>();
  for (const issue of project.issues)
    if (issue.initiative) namedByIssues.set(issue.initiative.id, issue.initiative);
  for (const i of linkable) namedByIssues.delete(i.id);
  return [
    ...linkable.map((i) => ({ value: i.id, label: i.title })),
    ...[...namedByIssues.values()]
      .sort(compareByGroupOrder)
      .map((i) => ({ value: i.id, label: i.title })),
  ];
}

// The cycles to offer: the ones the project plans into, then the finished ones
// only the issues name, so work planned into them stays reachable.
function cycleOptions(project: ProjectDetail): FieldOption[] {
  const namedByIssues = new Map<number, string>();
  for (const issue of project.issues)
    if (issue.cycle) namedByIssues.set(issue.cycle.id, issue.cycle.name);
  for (const c of project.plannedCycles) namedByIssues.delete(c.id);
  return [
    ...project.plannedCycles.map((c) => ({
      value: c.id,
      label: c.name,
      color: CYCLE_STATUS_META[c.status].color,
    })),
    ...[...namedByIssues.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: id, label: name })),
  ];
}

// The people and agents a member field of this scope holds, plus the unset value.
function memberFieldOptions(
  project: ProjectDetail,
  scope: MemberScope,
  unsetLabel: string,
): FieldOption[] {
  return [
    ...memberCandidates(project.assignees, scope).map((a) => ({ value: a.userId, label: a.name })),
    { value: null, label: unsetLabel },
  ];
}

// Marks the first option, so a rule separates the ones naming a single cycle or
// initiative from the values that stand for a whole status.
function withDivider(options: FieldOption[]): FieldOption[] {
  return options.map((o, i) => (i === 0 ? { ...o, dividerBefore: true } : o));
}

// A fresh condition for a newly picked field, with the kind's first operator and
// no values, so it is inert (see isEffectiveCondition) until the user fills it in.
export function newCondition(spec: FieldSpec): FilterCondition {
  return {
    id: uuid(),
    field: spec.field,
    op: OPERATORS_BY_KIND[spec.kind][0],
    values: [],
  };
}

// The filter vocabulary in the reader's language: the field catalog of a project,
// the operator names, the boolean choices, and the short renderings a pill and a
// saved action show. `projectKey` is what the initiative options are read under —
// pass it wherever the catalog or a description is built.
export function useFilterFields(projectKey?: string) {
  const t = useTranslations('filters');
  const initiatives = useInitiativeOptionsQuery(projectKey ?? null).data ?? [];
  const operator = byKey(useTranslations('filters.operators'));
  const stateType = byKey(useTranslations('display.stateTypes'));
  const cycleStatus = byKey(useTranslations('filters.cycleStatus'));
  const initiativeStatus = byKey(useTranslations('filters.initiativeStatus'));
  const priorityLabel = usePriorityLabel();

  const booleanOptions: FieldOption[] = [
    { value: true, label: t('boolean.true') },
    { value: false, label: t('boolean.false') },
  ];

  const operatorLabel = (op: FilterCondition['op']) => operator(op);

  // The full catalog of filterable fields for a project: builtins plus every
  // custom field. `kept` is a filter set whose fields stay in the catalog even
  // when their section is off, so a condition saved earlier still renders as a
  // removable pill instead of filtering invisibly.
  const fieldSpecs = (
    project: ProjectDetail,
    customFields: CustomField[],
    kept?: FilterSet | null,
  ): FieldSpec[] => {
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
        field: 'initiative',
        label: t('fields.initiative'),
        kind: 'set',
        options: [
          ...INITIATIVE_FILTER_STATUSES.map((s) => ({
            value: statusValue(s),
            label: initiativeStatus(s),
          })),
          { value: null, label: t('unset.initiative') },
          ...withDivider(initiativeOptions(project, initiatives)),
        ],
      },
      {
        field: 'cycle',
        label: t('fields.cycle'),
        kind: 'set',
        options: [
          ...CYCLE_FILTER_STATUSES.map((s) => ({
            value: statusValue(s),
            label: cycleStatus(s),
            color: CYCLE_STATUS_META[s].color,
          })),
          { value: null, label: t('unset.cycle') },
          ...withDivider(cycleOptions(project)),
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
      let options: FieldOption[] | undefined;
      if (f.fieldType === 'member') {
        options = memberFieldOptions(project, f.memberScope ?? 'all', t('unset.member'));
      } else if (kind === 'set') {
        options = f.options.map((o) => ({ value: o.id, label: o.value, color: o.color }));
      }
      specs.push({ field: customFieldKey(f.id), label: f.name, kind, options });
    }
    // The fields of an optional section are offered only while it is on, as the
    // grouping fields and display properties are.
    const features = projectFeatures(project.project);
    const used = new Set((kept?.conditions ?? []).map((c) => c.field));
    return specs.filter(
      (s) => isFieldEnabled(s.field as GroupField, features) || used.has(s.field),
    );
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
    const byField = new Map(fieldSpecs(project, customFields, filters).map((s) => [s.field, s]));
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
