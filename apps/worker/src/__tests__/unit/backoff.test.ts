import { describe, it, expect } from 'bun:test';
import { equalJitterBackoffMs } from '../../backoff';

describe('equalJitterBackoffMs', () => {
  it('stays within [window/2, window] on the first attempt', () => {
    for (let i = 0; i < 100; i++) {
      const ms = equalJitterBackoffMs(1, 1000, 60_000);
      expect(ms).toBeGreaterThanOrEqual(500);
      expect(ms).toBeLessThanOrEqual(1000);
    }
  });

  it('doubles the window each attempt', () => {
    // attempt 3 window = base * 2^2 = 4000, so the delay is in [2000, 4000].
    for (let i = 0; i < 100; i++) {
      const ms = equalJitterBackoffMs(3, 1000, 60_000);
      expect(ms).toBeGreaterThanOrEqual(2000);
      expect(ms).toBeLessThanOrEqual(4000);
    }
  });

  it('never exceeds the cap', () => {
    for (let i = 0; i < 100; i++) {
      const ms = equalJitterBackoffMs(20, 1000, 5000);
      expect(ms).toBeGreaterThanOrEqual(2500);
      expect(ms).toBeLessThanOrEqual(5000);
    }
  });
});
