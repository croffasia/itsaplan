import { describe, it, expect, beforeEach } from 'bun:test';
import { auth, API_KEY_DEFAULT_EXPIRES_IN_SEC } from '@repo/auth';
import { apikey, db } from '@repo/db';
import { eq } from 'drizzle-orm';
import { apiKeyApi, app } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// A personal API key is a full-account credential, so one that was forgotten has
// to stop working on its own: every key gets an expiry, an expired one is refused,
// and the expiry cannot be changed once the key exists.

const DAY_SEC = 24 * 60 * 60;

// The key endpoints live behind the better-auth catch-all, which Eden Treaty does
// not model. A request carrying the session cookie also has to carry a trusted
// origin, as the browser's does.
const origin = (process.env.APP_URL ?? '').split(',')[0].trim();

function authRequest(path: string, headers: Record<string, string>, body: object) {
  return app.handle(
    new Request(`http://localhost/api/auth/api-key/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, ...headers },
      body: JSON.stringify(body),
    }),
  );
}

// Asserts that the moment is `seconds` from now, give or take the test's own run time.
function expectSecondsFromNow(value: string | Date | null | undefined, seconds: number) {
  expect(value).toBeTruthy();
  const distance = new Date(value!).getTime() - Date.now();
  expect(Math.abs(distance - seconds * 1000)).toBeLessThan(60_000);
}

describe('api keys', () => {
  beforeEach(resetDb);

  it('gives a key created without a lifetime the default one', async () => {
    const user = await signUpTestUser();

    const res = await authRequest('create', { cookie: user.cookie }, { name: 'ci' });

    expect(res.status).toBe(200);
    const created = (await res.json()) as { expiresAt: string | null };
    expectSecondsFromNow(created.expiresAt, API_KEY_DEFAULT_EXPIRES_IN_SEC);
  });

  it('accepts a shorter lifetime and refuses one past the maximum', async () => {
    const user = await signUpTestUser();

    const short = await authRequest(
      'create',
      { cookie: user.cookie },
      { name: 'short', expiresIn: 30 * DAY_SEC },
    );
    expect(short.status).toBe(200);
    expectSecondsFromNow(((await short.json()) as { expiresAt: string }).expiresAt, 30 * DAY_SEC);

    const long = await authRequest(
      'create',
      { cookie: user.cookie },
      { name: 'long', expiresIn: 366 * DAY_SEC },
    );
    expect(long.status).toBe(400);
  });

  it('refuses a key past its expiry', async () => {
    const user = await signUpTestUser();
    const created = await auth.api.createApiKey({ body: { userId: user.userId, name: 'ci' } });
    expect((await apiKeyApi(created.key).projects.get()).status).toBe(200);

    await db
      .update(apikey)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(apikey.id, created.id));

    expect((await apiKeyApi(created.key).projects.get()).status).toBe(401);

    // The plugin reports an expired key by throwing, which /me would otherwise
    // answer with a 500 instead of the "not signed in" it documents.
    const me = await apiKeyApi(created.key).me.get();
    expect(me.status).toBe(200);
    expect(me.data).toEqual({ authenticated: false });
  });

  it('refuses changing the expiry of a key, with the key itself included', async () => {
    const user = await signUpTestUser();
    const created = await auth.api.createApiKey({ body: { userId: user.userId, name: 'ci' } });

    const cleared = await authRequest(
      'update',
      { cookie: user.cookie },
      { keyId: created.id, expiresIn: null },
    );
    expect(cleared.status).toBe(403);

    const extended = await authRequest(
      'update',
      { 'x-api-key': created.key },
      { keyId: created.id, expiresIn: 365 * DAY_SEC },
    );
    expect(extended.status).toBe(403);

    const renamed = await authRequest(
      'update',
      { cookie: user.cookie },
      { keyId: created.id, name: 'renamed' },
    );
    expect(renamed.status).toBe(200);
    expectSecondsFromNow(
      ((await renamed.json()) as { expiresAt: string }).expiresAt,
      API_KEY_DEFAULT_EXPIRES_IN_SEC,
    );
  });

  it('lists a key with its expiry', async () => {
    const user = await signUpTestUser();
    await auth.api.createApiKey({ body: { userId: user.userId, name: 'ci' } });

    const res = await app.handle(
      new Request('http://localhost/api/auth/api-key/list', {
        headers: { cookie: user.cookie, origin },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { apiKeys: Array<{ expiresAt: string | null }> };
    expect(body.apiKeys).toHaveLength(1);
    expectSecondsFromNow(body.apiKeys[0].expiresAt, API_KEY_DEFAULT_EXPIRES_IN_SEC);
  });
});
