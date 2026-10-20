import { describe, it, expect, beforeEach } from 'bun:test';
import { auth, setAuthSettings } from '@repo/auth';
import { db, verification } from '@repo/db';
import { like } from 'drizzle-orm';
import { app, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The reset link goes out by mail, and no provider is configured in tests, so the
// token is read from the verification row better-auth wrote for it.
async function resetTokens(): Promise<string[]> {
  const rows = await db
    .select({ identifier: verification.identifier })
    .from(verification)
    .where(like(verification.identifier, 'reset-password:%'));
  return rows.map((row) => row.identifier.slice('reset-password:'.length));
}

async function resetToken(): Promise<string> {
  const tokens = await resetTokens();
  expect(tokens).toHaveLength(1);
  return tokens[0];
}

// The endpoint the forgot-password screen posts to, through the same gate as the browser.
function requestReset(email: string) {
  return app.handle(
    new Request('http://localhost/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, redirectTo: 'http://localhost:3001/reset-password' }),
    }),
  );
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

  it('mails no reset link while password sign-in is off', async () => {
    const user = await signUpTestUser();
    await setAuthSettings({ emailPassword: false });

    const res = await requestReset(user.email);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'PASSWORD_AUTH_DISABLED' });
    expect(await resetTokens()).toHaveLength(0);
  });

  it('mails a reset link while password sign-in is on', async () => {
    const user = await signUpTestUser();

    const res = await requestReset(user.email);

    expect(res.status).toBe(200);
    expect(await resetTokens()).toHaveLength(1);
  });
});
