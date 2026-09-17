import { beforeEach, describe, expect, it } from 'bun:test';
import { setAuthSettings } from '@repo/auth';
import { api, app, authedApi } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { addUser, setup, type Actor } from '../helpers';

const PASSWORD = 'test-password-123';

// The password endpoints live behind the better-auth catch-all, which Eden Treaty
// does not model, so they are driven through the app handler directly.
function authRequest(path: string, body: object) {
  return app.handle(
    new Request(`http://localhost/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

function signUp(email: string) {
  return authRequest('/sign-up/email', { email, password: PASSWORD, name: 'Someone' });
}

function signIn(email: string) {
  return authRequest('/sign-in/email', { email, password: PASSWORD });
}

// The Cookie header a browser would send back after this response; empty when the
// response set no session.
function cookieOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

// Port 1 is deliberately unreachable: the confirmation mail sign-up sends is best
// effort, and a refused connection is what keeps it from waiting on a DNS lookup.
const smtpProvider = {
  smtp: {
    enabled: true,
    host: '127.0.0.1',
    port: 1,
    encryption: 'none' as const,
    username: '',
    timeout: 1,
  },
  resend: { enabled: false },
  from: 'noreply@example.com',
};

async function requireVerification(god: Actor): Promise<void> {
  await god.api.god['email-settings'].put(smtpProvider);
  const res = await god.api.god['auth-settings'].put({ requireEmailVerification: true });
  expect(res.status).toBe(200);
}

describe('email verification', () => {
  beforeEach(resetDb);

  it('opens no session at sign-up while a confirmed address is required', async () => {
    const { god } = await setup();
    await requireVerification(god);

    const res = await signUp('new@example.com');

    expect(res.status).toBe(200);
    expect(((await res.json()) as { token: string | null }).token).toBeNull();
    expect((await authedApi(cookieOf(res)).projects.get()).status).toBe(401);
    expect((await signIn('new@example.com')).status).toBe(403);
    expect((await api['auth-config'].get()).data).toMatchObject({
      requireEmailVerification: true,
    });
  });

  it('keeps open sessions working and lets a confirmed account sign in', async () => {
    const { god } = await setup();
    const member = await addUser({ email: 'member@example.com' });
    await requireVerification(god);

    expect((await god.api.god['auth-settings'].get()).status).toBe(200);
    expect((await member.api.projects.get()).status).toBe(200);
    expect((await signIn(member.email)).status).toBe(403);

    await god.api.god.users({ userId: member.id })['verify-email'].post();

    const res = await signIn(member.email);
    expect(res.status).toBe(200);
    expect((await authedApi(cookieOf(res)).projects.get()).status).toBe(200);
  });

  it('signs up straight into a session while no confirmation is required', async () => {
    await setup();

    const res = await signUp('new@example.com');

    expect(res.status).toBe(200);
    expect((await authedApi(cookieOf(res)).projects.get()).status).toBe(200);
  });

  // The api never writes this state, but the gate must not depend on the provider:
  // the requirement is cleared with it, not lifted while it is missing.
  it('enforces the requirement without a mail provider', async () => {
    await setup();
    await setAuthSettings({ requireEmailVerification: true });

    const res = await signUp('new@example.com');

    expect((await authedApi(cookieOf(res)).projects.get()).status).toBe(401);
    expect((await signIn('new@example.com')).status).toBe(403);
  });

  it('drops the requirement when the mail provider is removed', async () => {
    const { god } = await setup();
    await requireVerification(god);

    const removed = await god.api.god['email-settings'].put({
      ...smtpProvider,
      smtp: { ...smtpProvider.smtp, enabled: false },
    });

    expect(removed.status).toBe(200);
    expect((await god.api.god['auth-settings'].get()).data).toMatchObject({
      requireEmailVerification: false,
    });
    expect((await api['auth-config'].get()).data).toMatchObject({
      requireEmailVerification: false,
    });
    const res = await signUp('new@example.com');
    expect((await authedApi(cookieOf(res)).projects.get()).status).toBe(200);
  });
});
