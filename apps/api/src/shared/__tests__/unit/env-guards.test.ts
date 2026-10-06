import { describe, expect, it } from 'bun:test';
import { assertLeaseExceedsMs, RUNNER_HEARTBEAT_MS } from '../../env-guards';

describe('assertLeaseExceedsMs', () => {
  it('allows a lease above the minimum', () => {
    expect(() => assertLeaseExceedsMs(300, 240_000, 'LEASE', 'TIMEOUT')).not.toThrow();
  });

  it('rejects a lease at or below the minimum', () => {
    expect(() => assertLeaseExceedsMs(60, RUNNER_HEARTBEAT_MS, 'LEASE', 'heartbeat')).toThrow(
      /LEASE=60s must exceed heartbeat/,
    );
    expect(() => assertLeaseExceedsMs(10, 30_000, 'LEASE', 'TIMEOUT')).toThrow(
      /another worker reclaims/,
    );
  });
});
