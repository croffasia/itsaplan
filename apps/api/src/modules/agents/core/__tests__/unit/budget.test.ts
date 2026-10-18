import { describe, it, expect } from 'bun:test';
import { monthStart } from '../../budget';

describe('monthStart', () => {
  it('is midnight UTC on the first day of the month', () => {
    expect(monthStart(new Date('2026-10-17T15:30:00Z')).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });

  it('keeps the first instant of a month in that month', () => {
    expect(monthStart(new Date('2026-03-01T00:00:00Z')).toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    );
  });

  it('reads the month in UTC, not in local time', () => {
    expect(monthStart(new Date('2026-12-31T23:59:59.999Z')).toISOString()).toBe(
      '2026-12-01T00:00:00.000Z',
    );
    expect(monthStart(new Date('2026-01-01T00:30:00+02:00')).toISOString()).toBe(
      '2025-12-01T00:00:00.000Z',
    );
  });
});
