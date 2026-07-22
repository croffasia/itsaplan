// Shared model for manual actions' effects. An effect is a partial issue patch
// over built-in fields; a field is "set" when its key is present in the object
// (its value may be null, meaning "clear it" on apply), and an absent key leaves
// the field unchanged. Applying an effect is a single issue update with the
// effect object as the patch (see api.updateIssue / useUpdateIssue).

import type { ActionEffect, ProjectDetail } from '@/lib/api';
import { priorityLabel } from '@/utils/fieldOptions';
import { formatDate } from '@/utils/dates';

// The built-in fields an effect can set, in display order.
export const EFFECT_FIELD_KEYS = [
  'columnId',
  'assigneeUserId',
  'priority',
  'typeId',
  'startDate',
  'dueDate',
  'labelIds',
] as const;
export type EffectFieldKey = (typeof EFFECT_FIELD_KEYS)[number];

export const EFFECT_FIELD_LABELS: Record<EffectFieldKey, string> = {
  columnId: 'State',
  assigneeUserId: 'Assignee',
  priority: 'Priority',
  typeId: 'Type',
  startDate: 'Start date',
  dueDate: 'Due date',
  labelIds: 'Labels',
};

// The effect field keys actually set on this effect, in display order.
export function effectFieldKeys(effect: ActionEffect): EffectFieldKey[] {
  return EFFECT_FIELD_KEYS.filter((k) => k in effect);
}

// Whether the effect changes anything (has at least one set field).
export function isEmptyEffect(effect: ActionEffect): boolean {
  return effectFieldKeys(effect).length === 0;
}

function dateLabel(v: string | null | undefined): string {
  return v ? formatDate(v) : 'Cleared';
}

// The display value of one set effect field, resolving ids to project names.
export function effectValueLabel(
  effect: ActionEffect,
  key: EffectFieldKey,
  project: ProjectDetail,
): string {
  switch (key) {
    case 'columnId':
      return project.columns.find((c) => c.id === effect.columnId)?.name ?? '—';
    case 'assigneeUserId':
      return effect.assigneeUserId == null
        ? 'No assignee'
        : (project.assignees.find((a) => a.userId === effect.assigneeUserId)?.name ?? '—');
    case 'priority':
      return priorityLabel(effect.priority);
    case 'typeId':
      return effect.typeId == null
        ? 'No type'
        : (project.issueTypes.find((t) => t.id === effect.typeId)?.name ?? '—');
    case 'startDate':
      return dateLabel(effect.startDate);
    case 'dueDate':
      return dateLabel(effect.dueDate);
    case 'labelIds': {
      const ids = effect.labelIds ?? [];
      if (ids.length === 0) return 'None';
      return (
        project.labels
          .filter((l) => ids.includes(l.id))
          .map((l) => l.name)
          .join(', ') || '—'
      );
    }
  }
}

// Human-readable "State → Done" lines summarizing what an effect changes.
export function describeEffect(
  effect: ActionEffect,
  project: ProjectDetail,
): { key: EffectFieldKey; text: string }[] {
  return effectFieldKeys(effect).map((key) => ({
    key,
    text: `${EFFECT_FIELD_LABELS[key]} → ${effectValueLabel(effect, key, project)}`,
  }));
}
