'use client';

import {
  Bot,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CalendarSync,
  CircleDashed,
  CircleDot,
  CircleDotDashed,
  RefreshCw,
  Shapes,
  SignalHigh,
  Tag,
  Target,
  UserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { Assignee, ProjectDetail } from '@/lib/api/endpoints/projects';
import type { InitiativeRef } from '@/lib/api/endpoints/issues';
import type { InitiativeOption } from '@/lib/api/endpoints/initiatives';
import { useSession } from '@/lib/auth-client';
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
import Avatar from '@/components/common/Avatar';
import { colorDot } from '@/components/common/fields/colorDot';
import { FIELD_TYPE_ICONS } from '@/components/common/fields/fieldTypeIcons';
import { PRIORITY_FIELDS } from '@/components/common/fields/priorityFields';

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
      icon: colorDot(CYCLE_STATUS_META[c.status].color),
    })),
    ...[...namedByIssues.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: id, label: name })),
  ];
}

// A person or an agent, with the avatar the issue fields show.
function personOption(person: Assignee): FieldOption {
  return {
    value: person.userId,
    label: person.name,
    icon: <Avatar name={person.name} image={person.image} className="size-4 text-[8px]" />,
  };
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

// The filter vocabulary in the reader's language: the field catalog of a project
// with the icon of each field and value, the operator names, and the short
// renderings a chip and a saved action show. `projectKey` is what the initiative
// options are read under — pass it wherever the catalog or a description is built.
export function useFilterFields(projectKey?: string) {
  const t = useTranslations('filters');
  const self = useSession().data?.user;
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

  // An "is" that holds several values reads "is any of".
  const operatorLabel = (op: FilterCondition['op'], valueCount = 1) =>
    op === 'is' && valueCount > 1 ? t('isAnyOf') : operator(op);

  // A person field lists the reader first, as Me, then its unset value, then everyone
  // else. An agent field has no Me.
  const people = (candidates: Assignee[], unsetLabel: string, withMe: boolean): FieldOption[] => [
    ...(withMe && self
      ? [
          {
            value: self.id,
            label: t('me'),
            icon: <Avatar name={self.name} image={self.image} className="size-4 text-[8px]" />,
            keywords: [self.name],
          },
        ]
      : []),
    { value: null, label: unsetLabel, icon: <CircleDashed /> },
    ...candidates.filter((a) => !withMe || a.userId !== self?.id).map(personOption),
  ];

  // The full catalog of filterable fields for a project: builtins plus every
  // custom field. `kept` is a filter set whose fields stay in the catalog even
  // when their section is off, so a condition saved earlier still renders as a
  // removable pill instead of filtering invisibly.
  const fieldSpecs = (
    project: ProjectDetail,
    customFields: CustomField[],
    kept?: FilterSet | null,
  ): FieldSpec[] => {
    const labelGroups = new Map(project.labelGroups.map((g) => [g.id, g.name]));
    const specs: FieldSpec[] = [
      {
        field: 'status',
        label: t('fields.status'),
        icon: <CircleDot />,
        kind: 'set',
        options: project.columns.map((c) => ({
          value: c.id,
          label: c.name,
          icon: colorDot(c.color),
        })),
      },
      {
        field: 'statusType',
        label: t('fields.statusType'),
        icon: <CircleDotDashed />,
        kind: 'set',
        options: STATE_TYPES.map((value) => ({ value, label: stateType(value) })),
      },
      {
        field: 'assignee',
        label: t('fields.assignee'),
        icon: <UserRound />,
        kind: 'set',
        options: people(
          project.assignees.filter((a) => a.kind === 'member'),
          t('unset.assignee'),
          true,
        ),
      },
      {
        field: 'delegate',
        label: t('fields.delegate'),
        icon: <Bot />,
        kind: 'set',
        options: people(
          project.assignees.filter((a) => a.kind === 'agent'),
          t('unset.delegate'),
          false,
        ),
      },
      {
        field: 'priority',
        label: t('fields.priority'),
        icon: <SignalHigh />,
        kind: 'set',
        options: PRIORITY_FILTER_VALUES.map((value) => ({
          value,
          label: priorityLabel(value),
          icon: PRIORITY_FIELDS.find((p) => p.value === (value ?? ''))?.icon,
        })),
      },
      {
        field: 'type',
        label: t('fields.type'),
        icon: <Shapes />,
        kind: 'set',
        options: [
          ...project.issueTypes.map((ty) => ({
            value: ty.id,
            label: ty.name,
            icon: colorDot(ty.color),
          })),
          { value: null, label: t('unset.type'), icon: <CircleDashed /> },
        ],
      },
      {
        field: 'initiative',
        label: t('fields.initiative'),
        icon: <Target />,
        kind: 'set',
        options: [
          ...INITIATIVE_FILTER_STATUSES.map((s) => ({
            value: statusValue(s),
            label: initiativeStatus(s),
          })),
          { value: null, label: t('unset.initiative'), icon: <CircleDashed /> },
          ...withDivider(initiativeOptions(project, initiatives)),
        ],
      },
      {
        field: 'cycle',
        label: t('fields.cycle'),
        icon: <RefreshCw />,
        kind: 'set',
        options: [
          ...CYCLE_FILTER_STATUSES.map((s) => ({
            value: statusValue(s),
            label: cycleStatus(s),
            icon: colorDot(CYCLE_STATUS_META[s].color),
          })),
          { value: null, label: t('unset.cycle'), icon: <CircleDashed /> },
          ...withDivider(cycleOptions(project)),
        ],
      },
      {
        field: 'labels',
        label: t('fields.labels'),
        icon: <Tag />,
        kind: 'set',
        // A label is also found by the name of its group.
        options: project.labels.map((l) => {
          const group = l.groupId != null ? labelGroups.get(l.groupId) : undefined;
          return {
            value: l.id,
            label: l.name,
            icon: colorDot(l.color),
            keywords: group ? [group] : undefined,
          };
        }),
      },
      { field: 'dueDate', label: t('fields.dueDate'), icon: <CalendarClock />, kind: 'date' },
      { field: 'startDate', label: t('fields.startDate'), icon: <Calendar />, kind: 'date' },
      { field: 'created', label: t('fields.created'), icon: <CalendarPlus />, kind: 'date' },
      { field: 'updated', label: t('fields.updated'), icon: <CalendarSync />, kind: 'date' },
    ];
    for (const f of customFields) {
      const kind = customFieldKind(f);
      const Icon = FIELD_TYPE_ICONS[f.fieldType];
      let options: FieldOption[] | undefined;
      if (f.fieldType === 'member') {
        const scope = f.memberScope ?? 'all';
        options = people(
          memberCandidates(project.assignees, scope),
          t('unset.member'),
          scope !== 'agents',
        );
      } else if (kind === 'set') {
        options = f.options.map((o) => ({ value: o.id, label: o.value, icon: colorDot(o.color) }));
      } else if (kind === 'boolean') {
        options = booleanOptions;
      }
      specs.push({ field: customFieldKey(f.id), label: f.name, icon: <Icon />, kind, options });
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
    if (spec.kind === 'set' || spec.kind === 'boolean') {
      const labels = cond.values.map(
        (v: FilterValue) => spec.options?.find((o) => o.value === v)?.label ?? String(v),
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
      const op = operatorLabel(cond.op, cond.values.length);
      out.push(presence ? `${spec.label} ${op}` : `${spec.label} ${op} ${valuesLabel(spec, cond)}`);
    }
    return out;
  };

  return { fieldSpecs, operatorLabel, valuesLabel, describeConditions };
}
