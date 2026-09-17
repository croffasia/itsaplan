import { describe, it, expect, beforeEach } from 'bun:test';
import { auth } from '@repo/auth';
import { db, verification } from '@repo/db';
import { like } from 'drizzle-orm';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The reset link goes out by mail, and no provider is configured in tests, so the
// token is read from the verification row better-auth wrote for it.
async function resetToken(): Promise<string> {
  const rows = await db
    .select({ identifier: verification.identifier })
    .from(verification)
    .where(like(verification.identifier, 'reset-password:%'));
  expect(rows).toHaveLength(1);
  return rows[0].identifier.slice('reset-password:'.length);
}

describe('password reset', () => {
  beforeEach(resetDb);

  it('ends every session opened before the reset', async () => {
    const user = await signUpTestUser({ password: 'old-password-123' });
    const asUser = authedApi(user.cookie);
    expect((await asUser.projects.get()).status).toBe(200);

    await auth.api.requestPasswordReset({ body: { email: user.email } });
    await auth.api.resetPassword({
      body: { token: await resetToken(), newPassword: 'new-password-456' },
    });

    expect((await asUser.projects.get()).status).toBe(401);
  });
});
