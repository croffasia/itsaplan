import { type IssueFieldValueInput } from '@/lib/api';

// Whether a field value carries anything: an empty string and an empty option
// list read as untouched. The create modal skips such a value on save, and the
// body switcher marks the sections that have one.
export function hasFieldValue(
  value: IssueFieldValueInput | undefined,
): value is IssueFieldValueInput {
  if (!value) return false;
  return (value.optionIds?.length ?? 0) > 0 || (value.value != null && value.value !== '');
}
