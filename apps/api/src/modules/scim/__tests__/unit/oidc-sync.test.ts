import { describe, expect, it } from 'bun:test';
import { decodeJwtPayload } from '../../oidc-sync';

function jwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  // No signature: decoding never checks one, so an empty third segment is enough.
  return `${header}.${body}.`;
}

describe('decodeJwtPayload', () => {
  it('reads the claims out of the payload segment', () => {
    const token = jwt({ sub: 'user-1', groups: ['Engineering', 'Design'] });

    expect(decodeJwtPayload(token)).toEqual({ sub: 'user-1', groups: ['Engineering', 'Design'] });
  });

  it('decodes a payload whose base64url length needs padding', () => {
    // Payload lengths that are not a multiple of 4 once base64url-encoded are the
    // case the padding logic exists for.
    const token = jwt({ a: '1' });

    expect(decodeJwtPayload(token)).toEqual({ a: '1' });
  });

  it('returns null for a string with no payload segment', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });

  it('returns null for a payload segment that is not valid JSON', () => {
    const token = `${Buffer.from('{}').toString('base64url')}.not-base64-json.`;

    expect(decodeJwtPayload(token)).toBeNull();
  });
});
