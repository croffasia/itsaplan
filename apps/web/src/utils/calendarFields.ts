import type { CustomField, Issue, IssueFieldValueInput } from '@/lib/api';
import { dayKey, fromZonedParts, toZonedParts } from '@/utils/dates';
import {
  customFieldId,
  isCustomFieldKey,
  type BuiltinDateField,
  type DateField,
} from '@/utils/viewSettings';

// The date fields the Calendar can place issues by: the two built-in columns and
// any date / datetime / datetime range custom field.

// The time of day a datetime field takes when the issue had no value yet.
const DEFAULT_TIME = '09:00';

export function isCalendarField(field: CustomField): boolean {
  return (
    field.fieldType === 'date' ||
    field.fieldType === 'datetime' ||
    field.fieldType === 'datetime_range'
  );
}

// The custom field a `cf:<id>` placement points at, or null when the calendar is
// placed by a built-in column (or by a field that has since been deleted).
export function calendarCustomField(
  dateField: DateField,
  customFields: CustomField[],
): CustomField | null {
  if (!isCustomFieldKey(dateField)) return null;
  const id = customFieldId(dateField);
  return customFields.find((f) => f.id === id && isCalendarField(f)) ?? null;
}

// The built-in column a placement writes to. A custom field placement keeps the
// due date here as the fallback for a deleted field.
export function calendarBuiltinField(dateField: DateField): BuiltinDateField {
  return dateField === 'startDate' ? 'startDate' : 'dueDate';
}

// The day an issue sits on, as "YYYY-MM-DD". A datetime is bucketed by the day it
// falls on in the user's zone; a range by the day it starts on.
export function issueDay(
  issue: Issue,
  builtin: BuiltinDateField,
  custom: CustomField | null,
): string | null {
  if (!custom) return issue[builtin];
  const entry = issue.fieldValues.find((v) => v.fieldId === custom.id);
  const raw = typeof entry?.value === 'string' ? entry.value : null;
  if (!raw) return null;
  return custom.fieldType === 'date' ? raw : dayKey(raw);
}

// The value a drag onto `day` writes to a custom field, or the cleared value when
// the issue is dropped on the unscheduled panel. A datetime keeps its time of day
// and a range its length, so only the day moves.
export function rescheduleFieldValue(
  issue: Issue,
  custom: CustomField,
  day: string | null,
): IssueFieldValueInput {
  if (!day) return { value: null, valueEnd: null };
  if (custom.fieldType === 'date') return { value: day, valueEnd: null };

  const entry = issue.fieldValues.find((v) => v.fieldId === custom.id);
  const current = typeof entry?.value === 'string' ? entry.value : null;
  const time = (current ? toZonedParts(current)?.time : null) ?? DEFAULT_TIME;
  const value = fromZonedParts(day, time);
  if (custom.fieldType !== 'datetime_range' || !current || !entry?.valueEnd) {
    return { value, valueEnd: null };
  }
  const length = new Date(entry.valueEnd).getTime() - new Date(current).getTime();
  return { value, valueEnd: new Date(new Date(value).getTime() + length).toISOString() };
}
