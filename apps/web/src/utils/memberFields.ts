import type { Assignee, CustomField, Issue, MemberScope } from '@/lib/api';
import { customFieldId, isCustomFieldKey, type GroupField } from '@/utils/viewSettings';

// The custom fields that hold one person or agent. They are offered wherever the
// built-in assignee and delegate are: as a filter field, and as a grouping.

export function isMemberField(field: CustomField): boolean {
  return field.fieldType === 'member';
}

// The people and agents a member field of this scope holds.
export function memberCandidates(assignees: Assignee[], scope: MemberScope): Assignee[] {
  if (scope === 'humans') return assignees.filter((a) => a.kind === 'member');
  if (scope === 'agents') return assignees.filter((a) => a.kind === 'agent');
  return assignees;
}

// The member custom field a `cf:<id>` grouping points at, or null when the grouping
// names a built-in field (or a field that has since been deleted or retyped).
export function groupMemberField(
  group: GroupField,
  customFields: CustomField[],
): CustomField | null {
  if (!isCustomFieldKey(group)) return null;
  const id = customFieldId(group);
  return customFields.find((f) => f.id === id && isMemberField(f)) ?? null;
}

// The group key a member field's value belongs to, namespaced by the field so two
// member groupings never collide. A null user is the "No value" group.
export function memberGroupKey(fieldId: number, userId: string | null): string {
  return userId != null ? `f${fieldId}u${userId}` : `f${fieldId}-none`;
}

// Who a member field holds on an issue, or null when it holds no one.
export function memberFieldValue(issue: Issue, fieldId: number): string | null {
  const value = issue.fieldValues.find((v) => v.fieldId === fieldId)?.value;
  return typeof value === 'string' && value !== '' ? value : null;
}
