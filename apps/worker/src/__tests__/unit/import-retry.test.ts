import { describe, it, expect } from 'bun:test';
import { tickErrorOutcome, MAX_ATTEMPTS } from '../../import-retry';
import { SourceRateLimitedError, UnsupportedImportSourceError } from '../../reader';

describe('tickErrorOutcome', () => {
  it('waits out a rate limit with the exact last_error the Settings page matches', () => {
    expect(tickErrorOutcome(new SourceRateLimitedError(45_000), 1)).toEqual({
      action: 'retry',
      delayMs: 45_000,
      lastError: 'rate limited',
      countsAsAttempt: false,
    });
  });

  it('never fails a job for a rate limit, however many attempts ran', () => {
    expect(tickErrorOutcome(new SourceRateLimitedError(1000), MAX_ATTEMPTS + 5).action).toBe(
      'retry',
    );
  });

  it('retries any other error with backoff and its message', () => {
    const outcome = tickErrorOutcome(new Error('Plane request failed: HTTP 502'), 1);
    expect(outcome).toMatchObject({
      action: 'retry',
      lastError: 'Plane request failed: HTTP 502',
      countsAsAttempt: true,
    });
    const delayMs = (outcome as { delayMs: number }).delayMs;
    expect(delayMs).toBeGreaterThanOrEqual(30_000);
    expect(delayMs).toBeLessThanOrEqual(60_000);
  });

  it('fails the job once the consecutive attempts reach the limit', () => {
    expect(tickErrorOutcome(new Error('still broken'), MAX_ATTEMPTS)).toEqual({
      action: 'fail',
      lastError: 'still broken',
    });
  });

  it('records a thrown non-Error as its string form', () => {
    expect(tickErrorOutcome('boom', MAX_ATTEMPTS)).toEqual({ action: 'fail', lastError: 'boom' });
  });

  it('fails at once for an unsupported source, on the first attempt', () => {
    expect(tickErrorOutcome(new UnsupportedImportSourceError(7, 'jira'), 0)).toEqual({
      action: 'fail',
      lastError: 'import job 7 has unsupported source "jira"',
    });
  });
});
