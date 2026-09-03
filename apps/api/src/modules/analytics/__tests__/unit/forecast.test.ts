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
    });
  });

  it('takes the rate over the window and applies it to what is left', () => {
    // Last two days: 2 → 4, so 1/day; 6 left → 6 days after 5 March.
    const f = forecastCompletion(series([0, 1, 2, 3, 4]), 2);
    expect(f).toEqual({
      windowDays: 2,
      velocityPerDay: 1,
      remaining: 6,
      projectedDate: '2026-03-11',
    });
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
