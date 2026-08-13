import { addDays, startOfMonth, startOfWeek } from 'date-fns';
import { type CustomField, type Issue } from '@/lib/api';
import { issueDay } from '@/utils/calendarFields';
import type { BuiltinDateField, ViewSettings } from '@/utils/viewSettings';

// The calendar layout for the visible month: issues bucketed by their chosen date
// (a built-in column or a date custom field), the rest collected as unscheduled,
// the weekday headers rotated to the chosen first day, and the six-week day grid
// (a constant height regardless of month length).
export interface CalendarModel {
  byDay: Map<string, Issue[]>;
  unscheduled: Issue[];
  weekdays: string[];
  days: Date[];
}

export function buildCalendarModel(
  issues: Issue[],
  builtin: BuiltinDateField,
  // The custom field the issues are placed by, or null for the built-in column.
  custom: CustomField | null,
  weekStart: ViewSettings['weekStart'],
  cursor: Date,
  // The seven weekday names, Sunday first, in the reader's language.
  weekdayNames: string[],
): CalendarModel {
  const byDay = new Map<string, Issue[]>();
  const unscheduled: Issue[] = [];
  for (const issue of issues) {
    const day = issueDay(issue, builtin, custom);
    if (day) {
      const list = byDay.get(day) ?? [];
      list.push(issue);
      byDay.set(day, list);
    } else {
      unscheduled.push(issue);
    }
  }

  const weekdays = [...weekdayNames.slice(weekStart), ...weekdayNames.slice(0, weekStart)];
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: weekStart });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return { byDay, unscheduled, weekdays, days };
}
