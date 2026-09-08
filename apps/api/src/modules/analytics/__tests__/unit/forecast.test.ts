import { describe, it, expect } from 'bun:test';
import { forecastCompletion, type BurnupDay } from '../../service';

// forecastCompletion projects a completion date from the closing rate and the
// scope growth rate over the last `windowDays` points of a burnup series: the
// remaining issues plus the ones expected to appear while they are closed, at the
// closing rate, bracketed with a ±40% buffer on the days to go. It gives no date
// when nothing closed in the window or nothing is left.

function series(completed: number[], scope = 10): BurnupDay[] {
  return completed.map((c, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, '0')}`,
    scope,
    started: c,
    completed: c,
  }));
}

describe('forecastCompletion', () => {
  it('returns an empty forecast for an empty series', () => {
    expect(forecastCompletion([], 28)).toEqual({
      windowDays: 0,
      velocityPerDay: 0,
      scopeGrowthPerDay: 0,
      remaining: 0,
      projectedScope: 0,
      projectedDate: null,
      optimisticDate: null,
      pessimisticDate: null,
    });
  });

  it('takes the rate over the window and applies it to what is left', () => {
    // Last two days: 2 → 4, so 1/day; 6 left → 6 days after 5 March, bracketed by
    // 6 × 0.6 = 3.6 → 4 and 6 × 1.4 = 8.4 → 9 days.
    const f = forecastCompletion(series([0, 1, 2, 3, 4]), 2);
    expect(f).toEqual({
      windowDays: 2,
      velocityPerDay: 1,
      scopeGrowthPerDay: 0,
      remaining: 6,
      projectedScope: 10,
      projectedDate: '2026-03-11',
      optimisticDate: '2026-03-09',
      pessimisticDate: '2026-03-14',
    });
  });

  it('weights the latest whole week heaviest', () => {
    // Two weeks: 1/day, then 3/day; weights 1 and 2 → (1 + 6) / 3 = 2.33/day.
    const completed = [0, 1, 2, 3, 4, 5, 6, 7, 10, 13, 16, 19, 22, 25, 28];
    const f = forecastCompletion(series(completed, 100), 14);
    expect(f.velocityPerDay).toBe(2.33);
    // 72 left → 30.9 → 31 days after 15 March; 18.5 → 19 and 43.2 → 44 around it.
    expect(f.optimisticDate).toBe('2026-04-03');
    expect(f.projectedDate).toBe('2026-04-15');
    expect(f.pessimisticDate).toBe('2026-04-28');
  });

  it('keeps the range closed when a week closed nothing', () => {
    // 0/day then 1/day → 2/3 per day; 13 left → 19.5 → 20 days after 15 March.
    const completed = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7];
    const f = forecastCompletion(series(completed, 20), 14);
    expect(f.velocityPerDay).toBe(0.67);
    expect(f.projectedDate).toBe('2026-04-04');
    expect(f.pessimisticDate).toBe('2026-04-12');
  });

  it('uses the whole series when it is shorter than the window', () => {
    const f = forecastCompletion(series([0, 1, 2, 3, 4]), 28);
    expect(f.windowDays).toBe(4);
    expect(f.velocityPerDay).toBe(1);
  });

  it('rounds the rate to two decimals and rounds the days up', () => {
    // 2 closings over 3 days → 0.67/day; 9 left → 13.5 → 14 days after 4 March.
    const f = forecastCompletion(series([0, 0, 0, 2], 11), 3);
    expect(f.velocityPerDay).toBe(0.67);
    expect(f.projectedDate).toBe('2026-03-18');
  });

  it('adds the issues expected while the remaining ones are closed', () => {
    // Closing 1/day, scope growing 0.5/day (1 issue every other day); 6 left take
    // 6 days, during which 3 more appear → 9 days after 5 March, bracketed by
    // 5.4 → 6 and 12.6 → 13.
    const days = series([0, 1, 2, 3, 4]).map((d, i) => ({ ...d, scope: 8 + Math.floor(i / 2) }));
    const f = forecastCompletion(days, 4);
    expect(f).toMatchObject({
      velocityPerDay: 1,
      scopeGrowthPerDay: 0.5,
      remaining: 6,
      projectedScope: 13,
      optimisticDate: '2026-03-11',
      projectedDate: '2026-03-14',
      pessimisticDate: '2026-03-18',
    });
  });

  it('still gives a date when new issues outpace closings', () => {
    // 1/day closed, 2/day new; 8 left take 8 days, 16 more appear → 24 days.
    const days = series([0, 1, 2]).map((d, i) => ({ ...d, scope: 6 + 2 * i }));
    const f = forecastCompletion(days, 2);
    expect(f).toMatchObject({
      velocityPerDay: 1,
      scopeGrowthPerDay: 2,
      remaining: 8,
      projectedScope: 26,
      projectedDate: '2026-03-27',
    });
  });

  it('does not extrapolate a shrinking scope', () => {
    const days = series([0, 1, 2]).map((d, i) => ({ ...d, scope: 10 - 2 * i }));
    const f = forecastCompletion(days, 2);
    expect(f).toMatchObject({
      scopeGrowthPerDay: 0,
      projectedScope: 6,
      projectedDate: '2026-03-07',
    });
  });

  it('gives no date when nothing closed in the window', () => {
    const f = forecastCompletion(series([3, 3, 3]), 2);
    expect(f).toMatchObject({ velocityPerDay: 0, remaining: 7, projectedDate: null });
  });

  it('gives no date when issues were reopened faster than closed', () => {
    const f = forecastCompletion(series([4, 3, 2]), 2);
    expect(f).toMatchObject({ velocityPerDay: -1, projectedDate: null });
  });

  it('gives no date when everything is done', () => {
    const f = forecastCompletion(series([8, 9, 10]), 2);
    expect(f).toMatchObject({ remaining: 0, projectedDate: null });
  });

  it('gives no date from a single point', () => {
    const f = forecastCompletion(series([5]), 28);
    expect(f).toMatchObject({ windowDays: 0, velocityPerDay: 0, projectedDate: null });
  });

  it('crosses a month end and a year end when adding days', () => {
    const days: BurnupDay[] = [
      { date: '2026-12-29', scope: 4, started: 0, completed: 0 },
      { date: '2026-12-30', scope: 4, started: 2, completed: 2 },
    ];
    expect(forecastCompletion(days, 1).projectedDate).toBe('2026-12-31');
    for (const d of days) d.scope = 6;
    expect(forecastCompletion(days, 1).projectedDate).toBe('2027-01-01');
  });
});
