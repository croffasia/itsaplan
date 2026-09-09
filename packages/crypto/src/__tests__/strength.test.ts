import { describe, it, expect } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { assertStrongSecret, weakSecretReason } from '../strength';

const generated = randomBytes(32).toString('base64');

describe('weakSecretReason', () => {
  it('rejects an unset or empty value', () => {
    expect(weakSecretReason(undefined)).toBe('is not set');
    expect(weakSecretReason('')).toBe('is not set');
  });

  it('rejects a value shorter than 32 bytes', () => {
    expect(weakSecretReason('a'.repeat(31))).toBe('is shorter than 32 bytes');
    expect(weakSecretReason('a'.repeat(32))).toBeNull();
  });

  it('rejects the example values whatever their length', () => {
    expect(weakSecretReason('change-me-please-generate-a-real-secret')).toBe('is an example value');
    expect(weakSecretReason('better-auth-secret-12345678901234567890')).toBe('is an example value');
  });

  it('accepts a generated 32-byte base64 value', () => {
    expect(weakSecretReason(generated)).toBeNull();
  });
});

describe('assertStrongSecret', () => {
  it('returns the value when it is acceptable', () => {
    expect(assertStrongSecret('X', generated)).toBe(generated);
  });

  it('throws with the variable name and the reason otherwise', () => {
    expect(() => assertStrongSecret('BETTER_AUTH_SECRET', undefined)).toThrow(
      'BETTER_AUTH_SECRET is not set: generate one with `openssl rand -base64 32`.',
    );
    expect(() => assertStrongSecret('WORKER_INTERNAL_TOKEN', 'short')).toThrow(
      'WORKER_INTERNAL_TOKEN is shorter than 32 bytes',
    );
    expect(() =>
      assertStrongSecret('BETTER_AUTH_SECRET', 'change-me-please-generate-a-real-secret'),
    ).toThrow('BETTER_AUTH_SECRET is an example value');
  });
});
