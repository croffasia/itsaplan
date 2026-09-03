import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Burnup } from '@/lib/api';
import { buildBurnupPoints, MAX_TAIL_DAYS } from './burnupSeries';

// buildBurnupPoints appends the projection tail to the history: one point per
// future day, the projection running straight from today's completed count to the
// scope on the projected date.

function burnup(overrides: Partial<Burnup> = {}): Burnup {
  return {
    days: [
      { date: '2026-03-01', scope: 10, started: 4, completed: 2 },
      { date: '2026-03-02', scope: 10, started: 5, completed: 4 },
    ],
    forecast: { windowDays: 1, velocityPerDay: 2, remaining: 6, projectedDate: '2026-03-05' },
    targetDate: null,
    ...overrides,
  };
}

describe('buildBurnupPoints', () => {
  it('returns the history untouched when there is no forecast and no target', () => {
    const data = burnup({
      forecast: { windowDays: 1, velocityPerDay: 0, remaining: 6, projectedDate: null },
    });
    assert.deepEqual(buildBurnupPoints(data), data.days);
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
      forecast: { windowDays: 1, velocityPerDay: 0.01, remaining: 6, projectedDate: '2027-12-31' },
    });
    const points = buildBurnupPoints(data);
    assert.equal(points.length, 2 + MAX_TAIL_DAYS);
    assert.ok((points.at(-1)?.projection ?? 0) < 10);
  });

  it('returns an empty list for an empty series', () => {
    assert.deepEqual(buildBurnupPoints(burnup({ days: [] })), []);
  });
});
