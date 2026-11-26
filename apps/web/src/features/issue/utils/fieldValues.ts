import type { IssueFieldValue, IssueFieldValueInput } from '@/lib/api/endpoints/issues';

// Whether a field value carries anything: an empty string and an empty option
// list read as untouched. The create modal skips such a value on save, and the
// body switcher marks the sections that have one.
export function hasFieldValue(
  value: IssueFieldValueInput | undefined,
): value is IssueFieldValueInput {
  if (!value) return false;
  return (value.optionIds?.length ?? 0) > 0 || (value.value != null && value.value !== '');
}

// The key that remounts a field's editor. It changes with the field's own stored value
// only, so saving another property of the issue leaves the editor mounted.
export function fieldSaveKey(fieldId: number, current: IssueFieldValue | undefined): string {
  return `${fieldId}-${JSON.stringify(current ?? null)}`;
}
