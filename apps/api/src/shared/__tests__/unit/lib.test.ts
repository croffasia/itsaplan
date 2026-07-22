import { describe, it, expect } from 'bun:test';
import { HttpError, iso, num, pgErrorCode, rethrowDuplicate } from '../../lib';

describe('HttpError', () => {
  it('carries a status and message and is an Error', () => {
    const err = new HttpError(404, 'not found');
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.message).toBe('not found');
  });
});

describe('iso', () => {
  it('renders a Date as an ISO string', () => {
    expect(iso(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02T03:04:05.000Z');
  });
});

describe('pgErrorCode', () => {
  it('reads the code off the error itself', () => {
    expect(pgErrorCode({ code: '23505' })).toBe('23505');
  });

  it('unwraps the cause chain (Drizzle wraps the driver error)', () => {
    expect(pgErrorCode({ cause: { cause: { code: '23503' } } })).toBe('23503');
  });

  it('returns undefined when no code is present', () => {
    expect(pgErrorCode(new Error('boom'))).toBeUndefined();
    expect(pgErrorCode(null)).toBeUndefined();
  });

  it('ignores a non-string code', () => {
    expect(pgErrorCode({ code: 23505 })).toBeUndefined();
  });

  it('stops after a bounded depth instead of looping forever', () => {
    const deep = {
      cause: { cause: { cause: { cause: { cause: { cause: { code: '23505' } } } } } },
    };
    expect(pgErrorCode(deep)).toBeUndefined();
  });
});

describe('rethrowDuplicate', () => {
  it('maps a unique_violation to a 409 HttpError', () => {
    try {
      rethrowDuplicate({ code: '23505' }, 'label');
      throw new Error('did not throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(409);
      expect((err as HttpError).message).toContain('label');
    }
  });

  it('rethrows any other error unchanged', () => {
    const original = { code: '23503' };
    expect(() => rethrowDuplicate(original, 'label')).toThrow();
    try {
      rethrowDuplicate(original, 'label');
    } catch (err) {
      expect(err).toBe(original);
    }
  });
});

describe('num', () => {
  it('defaults null/undefined to 0', () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
  });

  it('coerces a numeric string to a number', () => {
    expect(num('12.5')).toBe(12.5);
  });

  it('passes a number through', () => {
    expect(num(3)).toBe(3);
  });
});
