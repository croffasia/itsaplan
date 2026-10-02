import { describe, expect, it } from 'bun:test';
import { assertLeaseExceedsMs } from '../../env-guards';

describe('assertLeaseExceedsMs', () => {
  it('allows a webhook lease above the HTTP timeout', () => {
    expect(() =>
      assertLeaseExceedsMs(120, 10_000, 'WEBHOOK_LEASE_SECONDS', 'WEBHOOK_TIMEOUT_MS'),
    ).not.toThrow();
  });

  it('rejects a lease that does not outlast the timeout', () => {
    expect(() =>
      assertLeaseExceedsMs(5, 30_000, 'WEBHOOK_LEASE_SECONDS', 'WEBHOOK_TIMEOUT_MS'),
    ).toThrow(/WEBHOOK_LEASE_SECONDS=5s must exceed WEBHOOK_TIMEOUT_MS/);
  });
});
