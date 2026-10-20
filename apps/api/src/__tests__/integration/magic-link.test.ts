import { describe, it, expect, beforeEach } from 'bun:test';
import { auth, setAuthSettings } from '@repo/auth';
import { db, verification } from '@repo/db';
import { like } from 'drizzle-orm';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

describe('magic link', () => {
  beforeEach(resetDb);

  // An OAuth state is one such identifier (GHSA-965c-763c-88jm).
  it('does not redeem a stored verification identifier as a token', async () => {
    const user = await signUpTestUser();
    await setAuthSettings({ magicLink: true });
    await auth.api.signInMagicLink({ body: { email: user.email }, headers: new Headers() });

    const rows = await db
      .select({ identifier: verification.identifier })
      .from(verification)
      .where(like(verification.value, `%${user.email}%`));
    expect(rows).toHaveLength(1);

    const res = await auth.api.magicLinkVerify({
      query: { token: rows[0].identifier, callbackURL: '/' },
      headers: new Headers(),
      asResponse: true,
    });

    expect(res.headers.get('location')).toContain('error=INVALID_TOKEN');
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});
