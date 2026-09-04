import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Burnup, BurnupForecast } from '@/lib/api';
import { buildBurnupPoints, MAX_TAIL_DAYS } from './burnupSeries';

// buildBurnupPoints appends the projection tail to the history: one point per
// future day, the projection running straight from today's completed count to the
// scope on the projected date, and in range mode a band between the optimistic
// and the pessimistic date.

function forecast(overrides: Partial<BurnupForecast> = {}): BurnupForecast {
  return {
    windowDays: 1,
    velocityPerDay: 2,
    scopeGrowthPerDay: 0,
    remaining: 6,
    projectedDate: '2026-03-05',
    optimisticDate: '2026-03-04',
    pessimisticDate: '2026-03-07',
    ...overrides,
  };
}

function burnup(overrides: Partial<Burnup> = {}): Burnup {
  return {
    days: [
      { date: '2026-03-01', scope: 10, started: 4, completed: 2 },
      { date: '2026-03-02', scope: 10, started: 5, completed: 4 },
    ],
    forecast: forecast(),
    targetDate: null,
    ...overrides,
  };
}

describe('buildBurnupPoints', () => {
  it('returns the history untouched when there is no forecast and no target', () => {
    const data = burnup({
      forecast: forecast({
        velocityPerDay: 0,
        projectedDate: null,
        optimisticDate: null,
        pessimisticDate: null,
      }),
    });
    assert.deepEqual(buildBurnupPoints(data), data.days);
    assert.deepEqual(buildBurnupPoints(data, true), data.days);
  });

  it('runs the projection from today to the scope on the projected date', () => {
    const points = buildBurnupPoints(burnup());
    assert.equal(points.length, 5);
    assert.deepEqual(points[1], {
      date: '2026-03-02',
      scope: 10,
      started: 5,
      completed: 4,
      projection: 4,
    });
    assert.deepEqual(points.slice(2), [
      { date: '2026-03-03', projection: 6 },
      { date: '2026-03-04', projection: 8 },
      { date: '2026-03-05', projection: 10 },
    ]);
  });

  it('drops the days before the first issue existed', () => {
    const empty = { scope: 0, started: 0, completed: 0 };
    const data = burnup();
    data.days = [{ date: '2026-02-27', ...empty }, { date: '2026-02-28', ...empty }, ...data.days];
    const points = buildBurnupPoints(data);
    assert.equal(points[0]?.date, '2026-03-01');
    assert.equal(points.at(-1)?.date, '2026-03-05');
  });

  it('draws the band to the scope on both dates and extends the axis to the slow one', () => {
    const points = buildBurnupPoints(burnup(), true);
    assert.equal(points.length, 7);
    assert.deepEqual(points[1]?.band, [4, 4]);
    assert.deepEqual(points[2], { date: '2026-03-03', projection: 6, band: [5, 7] });
    assert.deepEqual(points[3], { date: '2026-03-04', projection: 8, band: [6, 10] });
    assert.deepEqual(points[4], { date: '2026-03-05', projection: 10, band: [8, 10] });
    assert.deepEqual(points[5], { date: '2026-03-06', band: [9, 10] });
    assert.deepEqual(points[6], { date: '2026-03-07', band: [10, 10] });
  });

  it('extrapolates a growing scope and runs the projection up to it', () => {
    // Scope +1/day; the scope on 5 March is 13, the projection climbs 3/day to it,
    // and the fast edge, done on 4 March, follows the scope from there.
    const data = burnup({ forecast: forecast({ scopeGrowthPerDay: 1 }) });
    const points = buildBurnupPoints(data, true);
    assert.deepEqual(points[1], {
      date: '2026-03-02',
      scope: 10,
      started: 5,
      completed: 4,
      projection: 4,
      band: [4, 4],
      scopeProjection: 10,
    });
    assert.deepEqual(points[4], {
      date: '2026-03-05',
      projection: 13,
      band: [11, 13],
      scopeProjection: 13,
    });
    assert.deepEqual(points[6], { date: '2026-03-07', band: [15, 15], scopeProjection: 15 });
  });

  it('rounds the projected counts to whole issues', () => {
    const data = burnup({ forecast: forecast({ remaining: 6, projectedDate: '2026-03-09' }) });
    for (const p of buildBurnupPoints(data, true)) {
      for (const n of [p.projection, ...(p.band ?? [])]) {
        if (n !== undefined) assert.ok(Number.isInteger(n), `${p.date}: ${n}`);
      }
    }
  });

  it('ignores the range when not asked for it', () => {
    const points = buildBurnupPoints(burnup());
    assert.equal(points.at(-1)?.date, '2026-03-05');
    assert.equal(points[2]?.band, undefined);
  });

  it('extends the axis to a later target date without projecting past the projected date', () => {
    const points = buildBurnupPoints(burnup({ targetDate: '2026-03-07' }));
    assert.deepEqual(points.at(-1), { date: '2026-03-07' });
    assert.deepEqual(points.at(-2), { date: '2026-03-06' });
    assert.deepEqual(points[4], { date: '2026-03-05', projection: 10 });
  });

  it('ignores a target date in the past', () => {
    const points = buildBurnupPoints(burnup({ targetDate: '2026-02-01' }));
    assert.equal(points.at(-1)?.date, '2026-03-05');
  });

  it('cuts the tail at the cap', () => {
    const data = burnup({
      forecast: forecast({ velocityPerDay: 0.01, projectedDate: '2027-12-31' }),
    });
    const points = buildBurnupPoints(data);
    assert.equal(points.length, 2 + MAX_TAIL_DAYS);
    assert.ok((points.at(-1)?.projection ?? 0) < 10);
  });

  it('returns an empty list for an empty series', () => {
    assert.deepEqual(buildBurnupPoints(burnup({ days: [] })), []);
  });
});
