import type { Burnup } from '@/lib/api';
import { addDays, daysBetween, parseDate, toDateStr } from '@/utils/dates';

// One point of the burnup chart: the three history series on a past day, the
// projection (and, in range mode, the band) on a future one, and both on the last
// real day, where they meet. `band` is [slow, fast]: the completed count on that
// day at the pessimistic and at the optimistic pace. `scopeProjection` is the
// scope extrapolated at its growth rate, present only when the scope is growing.
export interface BurnupPoint {
  date: string;
  scope?: number;
  started?: number;
  completed?: number;
  projection?: number;
  band?: [number, number];
  scopeProjection?: number;
}

// The future part of the axis is cut here so a slow project cannot squash its
// history into a sliver. The caption still names the full projected date.
export const MAX_TAIL_DAYS = 180;

// The chart points: the history from the first day anything existed (days before
// the first issue are dropped, so a young project does not start with a run of
// empty weeks), then one point per future day up to the projected date (the
// pessimistic one in range mode) or the initiative's target date, whichever is
// later. The projection runs straight from today's completed count to the
// projected scope on the projected date and stops there; each edge of the band
// does the same on its own date. Counts are whole issues, as in the history.
export function buildBurnupPoints(data: Burnup, range = false): BurnupPoint[] {
  const firstReal = data.days.findIndex((d) => d.scope > 0 || d.started > 0 || d.completed > 0);
  const points: BurnupPoint[] = data.days.slice(Math.max(0, firstReal)).map((d) => ({ ...d }));
  const last = data.days.at(-1);
  const lastDate = last ? parseDate(last.date) : null;
  if (!last || !lastDate) return points;

  const { forecast } = data;
  const toProjected = daysAfter(lastDate, forecast.projectedDate);
  const toFast = range ? daysAfter(lastDate, forecast.optimisticDate) : 0;
  const toSlow = range ? daysAfter(lastDate, forecast.pessimisticDate) : 0;
  const tail = Math.min(
    Math.max(toProjected, toSlow, daysAfter(lastDate, data.targetDate)),
    MAX_TAIL_DAYS,
  );
  const scopeAt = (i: number) => Math.round(last.scope + forecast.scopeGrowthPerDay * i);
  const towards = (i: number, span: number) =>
    i >= span
      ? scopeAt(i)
      : Math.round(last.completed + ((scopeAt(span) - last.completed) * i) / span);
  const toScope = forecast.scopeGrowthPerDay > 0 ? Math.max(toProjected, toSlow) : 0;

  if (toProjected > 0) points[points.length - 1]!.projection = last.completed;
  if (toSlow > 0) points[points.length - 1]!.band = [last.completed, last.completed];
  if (toScope > 0) points[points.length - 1]!.scopeProjection = last.scope;
  for (let i = 1; i <= tail; i++) {
    const point: BurnupPoint = { date: toDateStr(addDays(lastDate, i)) };
    if (toProjected > 0 && i <= toProjected) point.projection = towards(i, toProjected);
    if (toSlow > 0 && i <= toSlow) point.band = [towards(i, toSlow), towards(i, toFast)];
    if (toScope > 0 && i <= toScope) point.scopeProjection = scopeAt(i);
    points.push(point);
  }
  return points;
}

// Whole days from `from` to a 'YYYY-MM-DD' date; 0 for null, unparseable, or past.
function daysAfter(from: Date, value: string | null): number {
  const date = parseDate(value);
  return date ? Math.max(0, daysBetween(from, date)) : 0;
}
