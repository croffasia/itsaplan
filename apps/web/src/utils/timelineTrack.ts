import { startOfDay } from 'date-fns';
import { addDays, daysBetween, formatMonthYear } from '@/utils/dates';

// The day track the date-laid-out views place their bars on: the work items
// timeline and the cycles timeline. Holds the geometry only — which rows exist and
// what a bar means is the view's own.

// The label column on the left of a timeline: its default width, what a drag of the
// resize grip may take it down to and up to, and the fixed width small screens get
// instead, where the day track needs the room more than the labels do.
export const LABEL_W = 256;
export const LABEL_NARROW_W = 140;
export const LABEL_MIN_W = 160;
export const LABEL_MAX_W = 640;

// A consecutive same-month run, for the month labels above the day numbers.
export interface MonthLabel {
  label: string;
  left: number;
  width: number;
}

export interface DayTrack {
  days: Date[];
  months: MonthLabel[];
  trackWidth: number;
  todayLeft: number;
  todayInRange: boolean;
  dayLines: { backgroundImage: string };
  spanToRect: (start: Date, end: Date) => { left: number; width: number };
}

// The track covering `min`..`max` with padding on both sides, extended on the right
// with trailing days so it fills the viewport instead of leaving empty space; the
// day size stays fixed. An empty range (both null) falls back to the four weeks
// after today.
export function buildDayTrack({
  min,
  max,
  viewportW,
  labelW,
  dayW,
}: {
  min: Date | null;
  max: Date | null;
  viewportW: number;
  labelW: number;
  dayW: number;
}): DayTrack {
  const today = startOfDay(new Date());
  const rangeStart = addDays(min ?? today, -3);
  const rangeEnd = addDays(max ?? addDays(today, 28), 7);
  const naturalDays = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);
  const daysToFill = Math.ceil(Math.max(0, viewportW - labelW) / dayW);
  const totalDays = Math.max(naturalDays, daysToFill);
  const trackWidth = totalDays * dayW;
  const days = Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));

  const months: MonthLabel[] = [];
  for (let i = 0; i < days.length; i++) {
    const label = formatMonthYear(days[i]);
    const last = months[months.length - 1];
    if (last && last.label === label) last.width += dayW;
    else months.push({ label, left: i * dayW, width: dayW });
  }

  // Per-day gridlines when days are wide; weekly gridlines when zoomed out, so
  // narrow days do not turn the track into solid lines.
  const gridPeriod = dayW >= 20 ? dayW : dayW * 7;
  const dayLines = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${gridPeriod - 1}px, var(--border) ${gridPeriod - 1}px, var(--border) ${gridPeriod}px)`,
  };

  return {
    days,
    months,
    trackWidth,
    todayLeft: daysBetween(rangeStart, today) * dayW,
    todayInRange: today >= rangeStart && today <= rangeEnd,
    dayLines,
    spanToRect: (start: Date, end: Date) => ({
      left: daysBetween(rangeStart, start) * dayW,
      width: (daysBetween(start, end) + 1) * dayW,
    }),
  };
}
