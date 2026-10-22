import { describe, it, expect } from 'bun:test';
import { isRetryableStatus } from '../../delivery';

describe('isRetryableStatus', () => {
  it('retries 408, 429, and 5xx', () => {
    for (const s of [408, 429, 500, 502, 503]) expect(isRetryableStatus(s)).toBe(true);
  });

  it('does not retry other 4xx', () => {
    for (const s of [400, 401, 403, 404, 410, 422]) expect(isRetryableStatus(s)).toBe(false);
  });
});
