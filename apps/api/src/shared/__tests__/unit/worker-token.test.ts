import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { workerTokenValid } from '../../worker-token';

const TOKEN = 'worker-token-unit-test-value-32-bytes-long';

describe('workerTokenValid', () => {
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env.WORKER_INTERNAL_TOKEN;
  });

  afterEach(() => {
    if (previous == null) delete process.env.WORKER_INTERNAL_TOKEN;
    else process.env.WORKER_INTERNAL_TOKEN = previous;
  });

  it('accepts the configured token', () => {
    process.env.WORKER_INTERNAL_TOKEN = TOKEN;
    expect(workerTokenValid({ 'x-worker-token': TOKEN })).toBe(true);
  });

  it('refuses a missing or different header', () => {
    process.env.WORKER_INTERNAL_TOKEN = TOKEN;
    expect(workerTokenValid({})).toBe(false);
    expect(workerTokenValid({ 'x-worker-token': '' })).toBe(false);
    expect(workerTokenValid({ 'x-worker-token': `${TOKEN}x` })).toBe(false);
  });

  it('refuses every request while the token is unset', () => {
    delete process.env.WORKER_INTERNAL_TOKEN;
    expect(workerTokenValid({ 'x-worker-token': '' })).toBe(false);
    expect(workerTokenValid({ 'x-worker-token': 'undefined' })).toBe(false);
  });

  it('refuses the matching header when the token is short or an example value', () => {
    for (const weak of ['short-token', 'change-me-please-generate-a-real-secret']) {
      process.env.WORKER_INTERNAL_TOKEN = weak;
      expect(workerTokenValid({ 'x-worker-token': weak })).toBe(false);
    }
  });
});
