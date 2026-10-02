import { describe, expect, it } from 'bun:test';
import { nextIdlePollMs } from '../../idle-poll';

describe('nextIdlePollMs', () => {
  it('uses the base on the first empty poll', () => {
    expect(nextIdlePollMs(0, 500, 8_000)).toBe(500);
  });

  it('doubles on each further empty poll', () => {
    expect(nextIdlePollMs(1, 500, 8_000)).toBe(1_000);
    expect(nextIdlePollMs(2, 500, 8_000)).toBe(2_000);
    expect(nextIdlePollMs(3, 500, 8_000)).toBe(4_000);
  });

  it('never exceeds the cap', () => {
    expect(nextIdlePollMs(10, 500, 2_000)).toBe(2_000);
  });

  it('raises a cap below the base up to the base', () => {
    expect(nextIdlePollMs(0, 2_000, 500)).toBe(2_000);
  });
});
