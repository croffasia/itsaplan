import { addDays, getWeek, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import type { Issue } from '@/lib/api/endpoints/issues';
import { parseDate, toDateStr } from '@/utils/dates';
import {
  isCustomFieldKey,
  type BuiltinDateField,
  type DateField,
  type ViewSettings,
  type WeekStart,
} from '@/utils/viewSettings';

// Drop target ids. A drop on `day:<YYYY-MM-DD>` moves the issue to that day, on
// `week:<first day>` to its own weekday in that week, on the unscheduled panel
// clears its date.
export const UNSCHEDULED_ID = 'unscheduled';
type DropKind = 'day' | 'week';

export const dropId = (kind: DropKind, date: string) => `${kind}:${date}`;

export function parseDropId(id: string | number): { kind: DropKind; date: string } | null {
  const [kind, date] = String(id).split(':');
  return (kind === 'day' || kind === 'week') && date ? { kind, date } : null;
}

// The message key for a date field. A custom field has no wording of its own and
// reads as a plain date.
export const dateFieldWording = (field: DateField): BuiltinDateField | 'custom' =>
  isCustomFieldKey(field) ? 'custom' : field;

export function bucketByDay(
  issues: Issue[],
  dayOf: (issue: Issue) => string | null,
): { byDay: Map<string, Issue[]>; unscheduled: Issue[] } {
  const byDay = new Map<string, Issue[]>();
  const unscheduled: Issue[] = [];
  for (const issue of issues) {
    const day = dayOf(issue);
    if (day) {
      const list = byDay.get(day) ?? [];
      list.push(issue);
      byDay.set(day, list);
    } else {
      unscheduled.push(issue);
    }
  }
  return { byDay, unscheduled };
}

// Whole weeks start on the week's first day and step a week at a time. Fewer days
// start on the cursor's own day and step by their count.
export const isFullWeek = (layout: Pick<ViewSettings, 'calendarMode' | 'calendarDays'>) =>
  layout.calendarMode === 'byWeek' ||
  (layout.calendarMode === 'byDay' && layout.calendarDays === 7);

// The days on screen. A month always gets six weeks, so the grid keeps one height
// whatever the month's length.
export function visibleDays(
  cursor: Date,
  layout: Pick<ViewSettings, 'calendarMode' | 'calendarDays' | 'calendarWeeks' | 'weekStart'>,
): Date[] {
  const weekStartsOn = layout.weekStart;
  const run = (first: Date, count: number) =>
    Array.from({ length: count }, (_, i) => addDays(first, i));
  if (layout.calendarMode === 'month')
    return run(startOfWeek(startOfMonth(cursor), { weekStartsOn }), 42);
  return run(
    isFullWeek(layout) ? startOfWeek(cursor, { weekStartsOn }) : startOfDay(cursor),
    layout.calendarMode === 'byWeek' ? layout.calendarWeeks * 7 : layout.calendarDays,
  );
}

// The day a drop on a week column gives an issue: the same weekday in that week, or
// the week's first day for an issue without a date.
export function dayInWeek(current: string | null, firstDay: string, weekStart: WeekStart): string {
  const first = parseDate(firstDay);
  const day = parseDate(current);
  if (!first || !day) return firstDay;
  return toDateStr(addDays(first, (day.getDay() - weekStart + 7) % 7));
}

// Monday weeks are numbered the ISO way, Sunday weeks the US way.
export function weekNumber(day: Date, weekStart: WeekStart): number {
  return getWeek(day, { weekStartsOn: weekStart, firstWeekContainsDate: weekStart === 1 ? 4 : 1 });
}
