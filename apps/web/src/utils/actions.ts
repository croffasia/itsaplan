// Shared model for manual actions' effects. An effect is a partial issue patch
// over built-in fields; a field is "set" when its key is present in the object
// (its value may be null, meaning "clear it" on apply), and an absent key leaves
// the field unchanged.

import type { ActionDef, ActionEffect } from '@/lib/api/endpoints/actions';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { EffectText } from '@/hooks/useEffectText';
import { formatDate } from '@/utils/dates';
import { matchesFilterSet } from '@/utils/filters';

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

// The effect field keys actually set on this effect, in display order.
export function effectFieldKeys(effect: ActionEffect): EffectFieldKey[] {
  return EFFECT_FIELD_KEYS.filter((k) => k in effect);
}

// Whether the effect changes anything (has at least one set field).
export function isEmptyEffect(effect: ActionEffect): boolean {
  return effectFieldKeys(effect).length === 0;
}

export function availableActionEffect(
  effect: ActionEffect,
  project: ProjectDetail,
  issue: Pick<Issue, 'columnId'>,
): ActionEffect {
  const { assigneeUserId, ...otherFields } = effect;
  if (assigneeUserId === null) return effect;
  if (assigneeUserId !== undefined) {
    return project.assignees.some((a) => a.userId === assigneeUserId && a.canAssign)
      ? effect
      : otherFields;
  }
  if (effect.columnId === undefined || effect.columnId === issue.columnId) return effect;
  const autoAssignee = project.columns.find((c) => c.id === effect.columnId)?.autoAssignUserId;
  return autoAssignee && project.assignees.some((a) => a.userId === autoAssignee && a.canAssign)
    ? { ...otherFields, assigneeUserId: autoAssignee }
    : otherFields;
}

// The project's manual actions whose condition matches this issue, in saved
// order. Shared by the issue detail Actions block and the context menu.
export function matchedActions(
  actions: ActionDef[],
  project: ProjectDetail,
  issue: Issue,
): ActionDef[] {
  return actions.filter((a) => {
    if (!matchesFilterSet(issue, a.condition, project)) return false;
    const { assigneeUserId, ...otherFields } = availableActionEffect(a.effect, project, issue);
    return (
      !isEmptyEffect(otherFields) ||
      (assigneeUserId !== undefined && assigneeUserId !== issue.assigneeUserId)
    );
  });
}

// The display value of one set effect field, resolving ids to project names.
export function effectValueLabel(
  effect: ActionEffect,
  key: EffectFieldKey,
  project: ProjectDetail,
  // Names the fields and the empty values in the reader's language (see useEffectText).
  text: EffectText,
): string {
  const dateLabel = (v: string | null | undefined) => (v ? formatDate(v) : text.cleared);
  switch (key) {
    case 'columnId':
      return project.columns.find((c) => c.id === effect.columnId)?.name ?? '—';
    case 'assigneeUserId':
      return effect.assigneeUserId == null
        ? text.noAssignee
        : (project.assignees.find((a) => a.userId === effect.assigneeUserId)?.name ?? '—');
    case 'priority':
      return text.priority(effect.priority ?? null);
    case 'typeId':
      return effect.typeId == null
        ? text.noType
        : (project.issueTypes.find((t) => t.id === effect.typeId)?.name ?? '—');
    case 'startDate':
      return dateLabel(effect.startDate);
    case 'dueDate':
      return dateLabel(effect.dueDate);
    case 'labelIds': {
      const ids = effect.labelIds ?? [];
      if (ids.length === 0) return text.noLabels;
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
  text: EffectText,
): { key: EffectFieldKey; text: string }[] {
  return effectFieldKeys(effect).map((key) => ({
    key,
    text: `${text.field(key)} → ${effectValueLabel(effect, key, project, text)}`,
  }));
}
