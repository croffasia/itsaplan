import { describe, expect, it } from 'bun:test';
import { parseScheduleTimestamp } from '../../schedule-timestamp';

describe('parseScheduleTimestamp', () => {
  it('converts a raw PostgreSQL timestamp into a Date', () => {
    const timestamp = parseScheduleTimestamp('2026-07-16 09:30:00+00');

    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.toISOString()).toBe('2026-07-16T09:30:00.000Z');
  });
});
