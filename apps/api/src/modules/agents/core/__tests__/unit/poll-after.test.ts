import { describe, it, expect } from 'bun:test';
import { pollAfterSeconds, QUEUED_POLL_SECONDS } from '../../run-queue';

const NOW = Date.parse('2026-11-18T12:00:00Z');
const secondsAgo = (s: number) => new Date(NOW - s * 1000);
const inSeconds = (s: number) => new Date(NOW + s * 1000);

const running = (startedSecondsAgo: number) =>
  pollAfterSeconds(
    {
      executionState: 'running',
      executionStartedAt: secondsAgo(startedSecondsAgo),
      nextAttemptAt: inSeconds(300),
      lastError: null,
    },
    NOW,
  );

describe('pollAfterSeconds', () => {
  it('has a waiting run read again soon', () => {
    expect(
      pollAfterSeconds(
        {
          executionState: 'queued',
          executionStartedAt: null,
          nextAttemptAt: inSeconds(0),
          lastError: null,
        },
        NOW,
      ),
    ).toBe(QUEUED_POLL_SECONDS);
  });

  it('reads a running run less often the longer it runs, from 5 to 30 seconds', () => {
    expect(running(8)).toBe(5);
    expect(running(60)).toBe(15);
    expect(running(600)).toBe(30);
  });

  it('reads a run waiting out a retry when the retry is due, within the same bounds', () => {
    const retrying = (dueInSeconds: number) =>
      pollAfterSeconds(
        {
          executionState: 'queued',
          executionStartedAt: null,
          nextAttemptAt: inSeconds(dueInSeconds),
          lastError: 'model timed out',
        },
        NOW,
      );
    expect(retrying(12)).toBe(12);
    expect(retrying(2)).toBe(5);
    expect(retrying(900)).toBe(30);
  });

  it('gives no wait once the run has ended', () => {
    for (const executionState of ['success', 'failed', 'canceled'] as const) {
      expect(
        pollAfterSeconds(
          {
            executionState,
            executionStartedAt: null,
            nextAttemptAt: inSeconds(0),
            lastError: null,
          },
          NOW,
        ),
      ).toBeUndefined();
    }
  });
});
