import { describe, expect, test } from 'bun:test';
import { nextCronRun } from '../../cron';

describe('nextCronRun', () => {
  test('calculates the next run in UTC', () => {
    const next = nextCronRun('0 9 * * *', new Date('2026-07-15T08:30:00.000Z'));
    expect(next.toISOString()).toBe('2026-07-15T09:00:00.000Z');
  });

  test('rejects an invalid expression', () => {
    expect(() => nextCronRun('not a cron')).toThrow('Invalid cron expression');
  });
});
