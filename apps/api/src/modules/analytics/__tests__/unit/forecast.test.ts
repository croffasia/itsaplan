import { describe, it, expect } from 'bun:test';
import { forecastCompletion, type BurnupDay } from '../../service';

// forecastCompletion projects a completion date from the closing rate over the
// last `windowDays` points of a burnup series, at the current scope. It gives no
// date when nothing closed in the window or nothing is left.

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
      remaining: 0,
      projectedDate: null,
      velocityRange: { min: 0, max: 0 },
      optimisticDate: null,
      pessimisticDate: null,
    });
  });

  it('takes the rate over the window and applies it to what is left', () => {
    // Last two days: 2 → 4, so 1/day; 6 left → 6 days after 5 March. Under a week
    // of history, so the range collapses onto the projection.
    const f = forecastCompletion(series([0, 1, 2, 3, 4]), 2);
    expect(f).toEqual({
      windowDays: 2,
      velocityPerDay: 1,
      remaining: 6,
      projectedDate: '2026-03-11',
      velocityRange: { min: 1, max: 1 },
      optimisticDate: '2026-03-11',
      pessimisticDate: '2026-03-11',
    });
  });

  it('brackets the projection with the slowest and fastest whole week', () => {
    // Two weeks: 0 → 7 (1/day), then 7 → 14 (1/day)... make the second week 3/day.
    const completed = [0, 1, 2, 3, 4, 5, 6, 7, 10, 13, 16, 19, 22, 25, 28];
    const f = forecastCompletion(series(completed, 100), 14);
    expect(f.velocityPerDay).toBe(2);
    expect(f.velocityRange).toEqual({ min: 1, max: 3 });
    // 72 left: 24 days at 3/day, 36 at 2/day, 72 at 1/day after 15 March.
    expect(f.optimisticDate).toBe('2026-04-08');
    expect(f.projectedDate).toBe('2026-04-20');
    expect(f.pessimisticDate).toBe('2026-05-26');
  });

  it('leaves the range open when a week closed nothing', () => {
    const completed = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7];
    const f = forecastCompletion(series(completed, 20), 14);
    expect(f.velocityRange).toEqual({ min: 0, max: 1 });
    expect(f.optimisticDate).toBe('2026-03-28');
    expect(f.pessimisticDate).toBeNull();
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
    days[1]!.scope = 6;
    expect(forecastCompletion(days, 1).projectedDate).toBe('2027-01-01');
  });
});
