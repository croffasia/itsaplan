import { describe, it, expect } from 'bun:test';
import { computeHealth, type HealthInput } from '../../health';

// computeHealth compares progress (share of completed issues) with elapsed time
// (share of the start->target window that has passed). Ahead of or level with the
// schedule is on_track; falling behind is at_risk then off_track. It returns null
// when there is nothing to judge (no active issues, or no target date).

const base: HealthInput = {
  completed: 0,
  total: 0,
  canceled: 0,
  startDate: '2026-01-01',
  targetDate: '2026-02-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  now: new Date('2026-01-16T00:00:00.000Z'),
};

describe('computeHealth', () => {
  it('returns null when there are no active issues', () => {
    expect(computeHealth({ ...base, total: 0, completed: 0, canceled: 0 })).toBeNull();
    // All issues canceled -> denominator zero -> nothing to judge.
    expect(computeHealth({ ...base, total: 3, completed: 0, canceled: 3 })).toBeNull();
  });

  it('returns on_track when everything is completed', () => {
    expect(computeHealth({ ...base, total: 5, completed: 5, canceled: 0 })).toBe('on_track');
  });

  it('returns null when there is no target date', () => {
    expect(
      computeHealth({ ...base, total: 4, completed: 1, canceled: 0, targetDate: null }),
    ).toBeNull();
  });

  it('is on_track when progress keeps up with elapsed time', () => {
    // Half the window elapsed, half the work done -> gap 0 -> on_track.
    expect(
      computeHealth({
        ...base,
        total: 4,
        completed: 2,
        now: new Date('2026-01-16T00:00:00.000Z'),
      }),
    ).toBe('on_track');
  });

  it('is at_risk when moderately behind schedule', () => {
    // ~48% elapsed, 25% done -> gap ~ -0.23 -> at_risk.
    expect(
      computeHealth({
        ...base,
        total: 4,
        completed: 1,
        now: new Date('2026-01-16T00:00:00.000Z'),
      }),
    ).toBe('at_risk');
  });

  it('is off_track when far behind schedule', () => {
    // ~90% elapsed, nothing done -> gap ~ -0.9 -> off_track.
    expect(
      computeHealth({
        ...base,
        total: 4,
        completed: 0,
        now: new Date('2026-01-28T00:00:00.000Z'),
      }),
    ).toBe('off_track');
  });

  it('is off_track when the target date has passed and work remains', () => {
    expect(
      computeHealth({
        ...base,
        total: 4,
        completed: 3,
        now: new Date('2026-02-05T00:00:00.000Z'),
      }),
    ).toBe('off_track');
  });

  it('falls back to createdAt when startDate is null', () => {
    // No startDate: the window is createdAt..target. Half elapsed, half done.
    expect(
      computeHealth({
        ...base,
        startDate: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        total: 4,
        completed: 2,
        now: new Date('2026-01-16T00:00:00.000Z'),
      }),
    ).toBe('on_track');
  });
});
