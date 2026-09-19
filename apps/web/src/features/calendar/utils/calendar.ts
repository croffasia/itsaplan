import {
  addDays,
  addMinutes,
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { CalendarEvent, GoogleCalendarInfo } from '@/lib/api';

export const VIEWS = ['month', 'week', 'day'] as const;
export type CalendarView = (typeof VIEWS)[number];

// The week starts on Monday, as it does in the rest of the dashboard.
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export const MINUTES_PER_DAY = 24 * 60;
// Height of one hour in the week and day grids, in pixels. The grid rows and the
// absolute positions of the events are both derived from it.
export const HOUR_HEIGHT = 48;

export function moveAnchor(view: CalendarView, anchor: Date, steps: number): Date {
  if (view === 'month') {
    const moved = new Date(anchor);
    moved.setMonth(moved.getMonth() + steps);
    return moved;
  }
  return addDays(anchor, steps * (view === 'week' ? 7 : 1));
}

// The days the view shows. A month view always shows whole weeks, so it starts
// before the first of the month and ends after the last.
export function visibleDays(view: CalendarView, anchor: Date): Date[] {
  if (view === 'day') return [startOfDay(anchor)];
  if (view === 'week') {
    const first = startOfWeek(anchor, WEEK_OPTIONS);
    return Array.from({ length: 7 }, (_, index) => addDays(first, index));
  }
  const first = startOfWeek(startOfMonth(anchor), WEEK_OPTIONS);
  const last = endOfWeek(endOfMonth(anchor), WEEK_OPTIONS);
  const days: Date[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
  return days;
}

export function weeksOf(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  return weeks;
}

// The window asked of the API: the visible days, widened by a day on each side so
// an event that starts late on the day before is included.
export function fetchWindow(view: CalendarView, anchor: Date): { from: string; to: string } {
  const days = visibleDays(view, anchor);
  return {
    from: addDays(startOfDay(days[0]), -1).toISOString(),
    to: addDays(endOfDay(days[days.length - 1]), 1).toISOString(),
  };
}

export function viewTitle(view: CalendarView, anchor: Date): string {
  if (view === 'day') return format(anchor, 'EEEE d MMMM yyyy');
  if (view === 'month') return format(anchor, 'MMMM yyyy');
  const days = visibleDays('week', anchor);
  const first = days[0];
  const last = days[6];
  const from = format(first, first.getMonth() === last.getMonth() ? 'd' : 'd MMM');
  return `${from} – ${format(last, 'd MMM yyyy')}`;
}

// An all-day event carries dates, and its end is the day after the last one it
// covers. Both are resolved to real instants here so the rest of the view compares
// them the same way.
export function eventBounds(event: CalendarEvent): { start: Date; end: Date } {
  if (!event.allDay) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    // A zero-length entry would be invisible in the time grid.
    return { start, end: end > start ? end : addMinutes(start, 30) };
  }
  return {
    start: startOfDay(new Date(`${event.start}T00:00:00`)),
    end: new Date(`${event.end}T00:00:00`),
  };
}

export function occursOn(event: CalendarEvent, day: Date): boolean {
  const { start, end } = eventBounds(event);
  return start < endOfDay(day) && end > startOfDay(day);
}

export function eventsOn(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((event) => occursOn(event, day));
}

// Where a timed event sits in a day column, as a fraction of the day. An event that
// runs over midnight is clipped to the day being drawn.
export function dayOffsets(
  event: CalendarEvent,
  day: Date,
): { topMinutes: number; heightMinutes: number } {
  const { start, end } = eventBounds(event);
  const from = start < startOfDay(day) ? startOfDay(day) : start;
  const to = end > endOfDay(day) ? endOfDay(day) : end;
  const topMinutes = differenceInMinutes(from, startOfDay(day));
  return {
    topMinutes,
    heightMinutes: Math.max(
      20,
      Math.min(MINUTES_PER_DAY - topMinutes, differenceInMinutes(to, from)),
    ),
  };
}

// Events that overlap in time share the width of the column, side by side. Columns
// are assigned greedily in start order, which is enough for a day's worth of
// entries and keeps every event readable.
export interface PlacedEvent {
  event: CalendarEvent;
  topMinutes: number;
  heightMinutes: number;
  column: number;
  columns: number;
}

export function placeDayEvents(events: CalendarEvent[], day: Date): PlacedEvent[] {
  const timed = events
    .filter((event) => !event.allDay)
    .map((event) => ({ event, ...dayOffsets(event, day) }))
    .sort((a, b) => a.topMinutes - b.topMinutes || b.heightMinutes - a.heightMinutes);

  const placed: PlacedEvent[] = [];
  // One cluster of overlapping events at a time: the width is shared within the
  // cluster, so the count is only known once the cluster is closed.
  let cluster: PlacedEvent[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    for (const item of cluster) item.columns = Math.max(...cluster.map((c) => c.column)) + 1;
    cluster = [];
  };

  for (const item of timed) {
    if (item.topMinutes >= clusterEnd && cluster.length > 0) closeCluster();
    const taken = new Set(
      cluster.filter((c) => c.topMinutes + c.heightMinutes > item.topMinutes).map((c) => c.column),
    );
    let column = 0;
    while (taken.has(column)) column += 1;
    const entry: PlacedEvent = { ...item, column, columns: 1 };
    cluster.push(entry);
    placed.push(entry);
    clusterEnd = Math.max(clusterEnd, item.topMinutes + item.heightMinutes);
  }
  if (cluster.length > 0) closeCluster();
  return placed;
}

export function timeLabel(event: CalendarEvent): string {
  if (event.allDay) return 'All day';
  const { start, end } = eventBounds(event);
  return `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`;
}

export function calendarColor(calendars: GoogleCalendarInfo[], calendarId: string): string {
  return calendars.find((item) => item.id === calendarId)?.color ?? '#9aa0a6';
}

// Black or white text on one of Google's calendar colours, whichever is readable.
// Their palette runs from pale yellow to deep blue, so a fixed colour fails on one
// end or the other.
export function textOn(background: string): string {
  const hex = background.replace('#', '');
  if (hex.length !== 6) return '#ffffff';
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.45 ? '#000000' : '#ffffff';
}

export function calendarName(calendars: GoogleCalendarInfo[], calendarId: string): string {
  return calendars.find((item) => item.id === calendarId)?.name ?? calendarId;
}

// The value an <input type="datetime-local"> holds, and the way back. The browser
// works in the viewer's own timezone, which is the one Google is given as well.
export function toLocalInput(date: Date, allDay: boolean): string {
  return format(date, allDay ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm");
}

export function fromLocalInput(value: string, allDay: boolean): string {
  return allDay ? value : new Date(value).toISOString();
}

// Google treats the end date of an all-day event as exclusive, so a single day runs
// to the next one. The dialog shows the last covered day, and this shifts it back.
export function allDayEndForApi(lastDay: string): string {
  return format(addDays(new Date(`${lastDay}T00:00:00`), 1), 'yyyy-MM-dd');
}

export function allDayEndForForm(exclusiveEnd: string): string {
  return format(addDays(new Date(`${exclusiveEnd}T00:00:00`), -1), 'yyyy-MM-dd');
}
