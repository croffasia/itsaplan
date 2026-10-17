import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { auth, setAuthSettings, setRegistrationAdmission } from '@repo/auth';
import { extendAuth } from '@repo/auth/extensions';
import { openMagicLink, signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// What a build adds to better-auth: plugins before the instance is first used, and its
// say on an account the registration gate would refuse.

describe('auth extensions', () => {
  beforeEach(resetDb);
  afterEach(() => setRegistrationAdmission());

  it('refuses a plugin once the instance has been used', () => {
    expect(auth.api).toBeDefined();
    expect(() => extendAuth({ plugins: [] })).toThrow();
  });

  it('lets an admitted account past a closed instance', async () => {
    await signUpTestUser({ name: 'Owner' });
    await setAuthSettings({ registration: 'closed' });
    setRegistrationAdmission(async (email) => email.endsWith('@company.com'));

    const admitted = await openMagicLink('newcomer@company.com', 'magic-admitted');
    expect(admitted.searchParams.get('error')).toBeNull();
    const refused = await openMagicLink('newcomer@gmail.com', 'magic-refused');
    expect(refused.searchParams.get('error')).toBe('REGISTRATION_CLOSED');
  });
});
