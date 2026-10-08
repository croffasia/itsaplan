import { describe, expect, it } from 'bun:test';
import { apiKeyRateLimit } from '@repo/auth';

// The api-key rate limit is read from the environment once, at startup.

describe('api key rate limit settings', () => {
  it('defaults to 100 requests per second, enabled', () => {
    expect(apiKeyRateLimit({})).toEqual({ enabled: true, timeWindow: 1000, maxRequests: 100 });
  });

  it('reads each setting from its variable', () => {
    expect(
      apiKeyRateLimit({
        API_KEY_RATE_LIMIT_ENABLED: 'false',
        API_KEY_RATE_LIMIT_WINDOW_MS: '60000',
        API_KEY_RATE_LIMIT_MAX: '600',
      }),
    ).toEqual({ enabled: false, timeWindow: 60_000, maxRequests: 600 });
  });

  it('keeps the default for a value that is not a positive number', () => {
    expect(
      apiKeyRateLimit({ API_KEY_RATE_LIMIT_WINDOW_MS: '0', API_KEY_RATE_LIMIT_MAX: 'many' }),
    ).toEqual({ enabled: true, timeWindow: 1000, maxRequests: 100 });
  });

  it('keeps the default for a value the key row cannot store', () => {
    expect(
      apiKeyRateLimit({
        API_KEY_RATE_LIMIT_WINDOW_MS: '2592000000',
        API_KEY_RATE_LIMIT_MAX: '10.5',
      }),
    ).toEqual({ enabled: true, timeWindow: 1000, maxRequests: 100 });
  });
});
