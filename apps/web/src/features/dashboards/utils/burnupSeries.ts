import type { Burnup } from '@/lib/api';
import { addDays, daysBetween, parseDate, toDateStr } from '@/utils/dates';

// One point of the burnup chart: the three history series on a past day, the
// projection on a future one, and both on the last real day, where they meet.
export interface BurnupPoint {
  date: string;
  scope?: number;
  started?: number;
  completed?: number;
  projection?: number;
}

// The future part of the axis is cut here so a slow project cannot squash its
// history into a sliver. The caption still names the full projected date.
export const MAX_TAIL_DAYS = 180;

// The chart points: the history as returned, then one point per future day up to
// the projected date or the initiative's target date, whichever is later. The
// projection runs straight from today's completed count to the scope on the
// projected date and stops there; the days after it (up to the target) are empty.
export function buildBurnupPoints(data: Burnup): BurnupPoint[] {
  const points: BurnupPoint[] = data.days.map((d) => ({ ...d }));
  const last = data.days.at(-1);
  const lastDate = last ? parseDate(last.date) : null;
  if (!last || !lastDate) return points;

  const toProjected = daysAfter(lastDate, data.forecast.projectedDate);
  const tail = Math.min(Math.max(toProjected, daysAfter(lastDate, data.targetDate)), MAX_TAIL_DAYS);
  if (toProjected > 0) points[points.length - 1]!.projection = last.completed;
  for (let i = 1; i <= tail; i++) {
    const point: BurnupPoint = { date: toDateStr(addDays(lastDate, i)) };
    if (toProjected > 0 && i <= toProjected) {
      point.projection = round1(last.completed + (data.forecast.remaining * i) / toProjected);
    }
    points.push(point);
  }
  return points;
}

// Whole days from `from` to a 'YYYY-MM-DD' date; 0 for null, unparseable, or past.
function daysAfter(from: Date, value: string | null): number {
  const date = parseDate(value);
  return date ? Math.max(0, daysBetween(from, date)) : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
