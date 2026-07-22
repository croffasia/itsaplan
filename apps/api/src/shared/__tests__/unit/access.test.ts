import { describe, it, expect } from 'bun:test';
import { requireUser } from '../../access';
import { HttpError } from '../../lib';

// Only requireUser is a pure function. The rest of access.ts (requireProjectAccess,
// requireProjectOwner, assertPermission, requireProjectPermission) resolves
// membership from the database and is covered by the feature integration tests
// through the guards.
describe('requireUser', () => {
  it('returns the user when a session is present', () => {
    const user = { id: 'u1' };
    expect(requireUser(user)).toBe(user);
  });

  it('throws 401 when the user is missing', () => {
    for (const absent of [null, undefined]) {
      try {
        requireUser(absent);
        throw new Error('did not throw');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(401);
      }
    }
  });
});
