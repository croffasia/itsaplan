import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { account, db } from '@repo/db';
import { trustedOrigins } from '@repo/auth';
import { eq } from 'drizzle-orm';
import { app, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

const ACCESS_TOKEN = 'provider-access-token';
const REFRESH_TOKEN = 'provider-refresh-token';

// With no id_token in the token response, better-auth reads the profile from userinfo.
function startProvider() {
  return Bun.serve({
    port: 0,
    fetch(req) {
      const { origin, pathname } = new URL(req.url);
      switch (pathname) {
        case '/.well-known/openid-configuration':
          return Response.json({
            issuer: origin,
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            userinfo_endpoint: `${origin}/userinfo`,
          });
        case '/token':
          return Response.json({
            access_token: ACCESS_TOKEN,
            refresh_token: REFRESH_TOKEN,
            token_type: 'Bearer',
            expires_in: 3600,
          });
        case '/userinfo':
          return Response.json({
            sub: 'idp-user-1',
            email: 'sso-user@example.com',
            email_verified: true,
            name: 'SSO User',
          });
        default:
          return new Response('Not found', { status: 404 });
      }
    },
  });
}

function cookiesOf(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

describe('OAuth tokens at rest', () => {
  let provider: ReturnType<typeof Bun.serve>;

  beforeEach(async () => {
    await resetDb();
    provider = startProvider();
  });

  afterEach(async () => {
    await provider.stop(true);
  });

  async function enableOidc() {
    const god = await signUpTestUser({ name: 'Root' });
    const res = await authedApi(god.cookie).god['oidc-settings'].put({
      discoveryUrl: `http://localhost:${provider.port}/.well-known/openid-configuration`,
      clientId: 'itsaplan',
      clientSecret: 'client-secret',
      label: 'Test IdP',
      enabled: true,
    });
    expect(res.status).toBe(200);
  }

  // The better-auth endpoints are not modelled by Eden Treaty, so they are driven
  // through the app handler.
  async function signInThroughProvider(): Promise<string> {
    const start = await app.handle(
      new Request('http://localhost/api/auth/sign-in/oauth2', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerId: 'oidc', callbackURL: '/' }),
      }),
    );
    expect(start.status).toBe(200);
    const { url } = (await start.json()) as { url: string };
    const state = new URL(url).searchParams.get('state') ?? '';

    const callback = await app.handle(
      new Request(`http://localhost/api/auth/oauth2/callback/oidc?code=code-1&state=${state}`, {
        headers: { cookie: cookiesOf(start) },
      }),
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).not.toContain('error');
    return cookiesOf(callback);
  }

  async function readAccessToken(cookie: string): Promise<string> {
    const res = await app.handle(
      new Request('http://localhost/api/auth/get-access-token', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: trustedOrigins[0], cookie },
        body: JSON.stringify({ providerId: 'oidc' }),
      }),
    );
    expect(res.status).toBe(200);
    return ((await res.json()) as { accessToken: string }).accessToken;
  }

  it('stores the tokens a provider returns encrypted, and hands them back decrypted', async () => {
    await enableOidc();
    const cookie = await signInThroughProvider();

    // Encryption at rest is only visible in the row itself.
    const [row] = await db.select().from(account).where(eq(account.providerId, 'oidc'));
    expect(row).toBeDefined();
    expect(row.accessToken).not.toContain(ACCESS_TOKEN);
    expect(row.refreshToken).not.toContain(REFRESH_TOKEN);

    expect(await readAccessToken(cookie)).toBe(ACCESS_TOKEN);
  });

  it('still reads a token stored in clear text before encryption was turned on', async () => {
    await enableOidc();
    const user = await signUpTestUser();
    // Such a row can no longer be produced through sign-in, so it is written directly.
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: 'idp-user-2',
      providerId: 'oidc',
      userId: user.userId,
      accessToken: ACCESS_TOKEN,
      refreshToken: REFRESH_TOKEN,
      accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      updatedAt: new Date(),
    });

    expect(await readAccessToken(user.cookie)).toBe(ACCESS_TOKEN);
  });
});
