import { describe, expect, it } from 'bun:test';
import { nextIdlePollMs } from '../idle-poll';

describe('nextIdlePollMs', () => {
  it('uses the base on the first empty poll', () => {
    expect(nextIdlePollMs(0, 3_000, 60_000)).toBe(3_000);
  });

  it('doubles on each further empty poll', () => {
    expect(nextIdlePollMs(1, 3_000, 60_000)).toBe(6_000);
    expect(nextIdlePollMs(2, 3_000, 60_000)).toBe(12_000);
  });

  it('never exceeds the cap', () => {
    expect(nextIdlePollMs(10, 3_000, 60_000)).toBe(60_000);
  });
});
