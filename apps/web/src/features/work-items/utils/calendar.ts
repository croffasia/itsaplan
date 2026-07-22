import { addDays, startOfMonth, startOfWeek } from 'date-fns';
import { type Issue } from '@/lib/api';
import type { ViewSettings } from '@/utils/viewSettings';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// The calendar layout for the visible month: issues bucketed by their chosen date
// (due or start), the rest collected as unscheduled, the weekday headers rotated
// to the chosen first day, and the six-week day grid (a constant height regardless
// of month length).
export interface CalendarModel {
  byDay: Map<string, Issue[]>;
  unscheduled: Issue[];
  weekdays: string[];
  days: Date[];
}

export function buildCalendarModel(
  issues: Issue[],
  dateField: ViewSettings['calendarDateField'],
  weekStart: ViewSettings['weekStart'],
  cursor: Date,
): CalendarModel {
  const byDay = new Map<string, Issue[]>();
  const unscheduled: Issue[] = [];
  for (const issue of issues) {
    const value = issue[dateField];
    if (value) {
      const list = byDay.get(value) ?? [];
      list.push(issue);
      byDay.set(value, list);
    } else {
      unscheduled.push(issue);
    }
  }

  const weekdays = [...WEEKDAYS.slice(weekStart), ...WEEKDAYS.slice(0, weekStart)];
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: weekStart });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return { byDay, unscheduled, weekdays, days };
}
