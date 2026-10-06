import { describe, expect, it } from 'bun:test';
import { nextIdlePollMs } from '../../idle-poll';

describe('nextIdlePollMs', () => {
  it('uses the base on the first empty poll', () => {
    expect(nextIdlePollMs(0, 2_000, 60_000)).toBe(2_000);
  });

  it('doubles on each further empty poll', () => {
    expect(nextIdlePollMs(1, 2_000, 60_000)).toBe(4_000);
    expect(nextIdlePollMs(2, 2_000, 60_000)).toBe(8_000);
  });

  it('never exceeds the cap', () => {
    expect(nextIdlePollMs(20, 2_000, 60_000)).toBe(60_000);
  });
});
