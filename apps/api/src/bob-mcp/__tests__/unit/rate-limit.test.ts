import { describe, expect, it } from 'bun:test';
import { ServiceRateLimiter } from '../../rate-limit';

describe('Bob MCP rate limiter', () => {
  it('allows the configured burst and rejects the next request', () => {
    const limiter = new ServiceRateLimiter({ capacity: 2, refillPerMinute: 1 });
    expect(limiter.take('bob-agent', 0)).toBe(true);
    expect(limiter.take('bob-agent', 0)).toBe(true);
    expect(limiter.take('bob-agent', 0)).toBe(false);
  });

  it('refills over time', () => {
    const limiter = new ServiceRateLimiter({ capacity: 1, refillPerMinute: 1 });
    expect(limiter.take('bob-agent', 0)).toBe(true);
    expect(limiter.take('bob-agent', 30_000)).toBe(false);
    expect(limiter.take('bob-agent', 60_000)).toBe(true);
  });
});
