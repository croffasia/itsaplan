import { describe, it, expect } from 'bun:test';
import { createHmac } from 'node:crypto';
import { signPayload } from '../index';

describe('signPayload', () => {
  it('produces t=<ts>,v1=<hmac> over `${ts}.${body}`', () => {
    const secret = 'whsec_test';
    const body = JSON.stringify({ a: 1 });
    const ts = 1_700_000_000;
    const expected = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    expect(signPayload(secret, ts, body)).toBe(`t=${ts},v1=${expected}`);
  });

  it('changes when the body changes', () => {
    expect(signPayload('s', 1, '{}')).not.toBe(signPayload('s', 1, '{ }'));
  });

  it('changes when the secret changes', () => {
    expect(signPayload('a', 1, '{}')).not.toBe(signPayload('b', 1, '{}'));
  });
});
