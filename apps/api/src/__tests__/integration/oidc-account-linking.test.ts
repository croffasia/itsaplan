import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { setAuthSettings } from '@repo/auth';
import { app, authedApi } from '#tests/helpers/app';
import { openMagicLink, signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// An OIDC sign-in whose address already has a confirmed account signs into it only
// when the provider says it verified the address. Some providers send the claim as a
// string (Amazon Cognito's userinfo does), and a string "false" must not count as
// verified, or anyone who can hold an unverified address at the provider takes the
// account that has it.
const profile = { sub: 'idp-someone', email: 'owner@example.com', name: 'Someone' };

// What the provider says about the address, and whether it says it in an id_token or
// only from its userinfo endpoint.
let emailVerified: unknown;
let withIdToken = false;

function unsignedIdToken(claims: object): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none' })}.${part(claims)}.`;
}

function startProvider() {
  return Bun.serve({
    port: 0,
    fetch(req) {
      const { origin, pathname } = new URL(req.url);
      const claims = { ...profile, email_verified: emailVerified };
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
            access_token: 'token',
            token_type: 'Bearer',
            expires_in: 3600,
            ...(withIdToken ? { id_token: unsignedIdToken(claims) } : {}),
          });
        // With an id_token, userinfo says the opposite, so a test passes only if the
        // id_token is what was read.
        case '/userinfo':
          return Response.json(withIdToken ? { ...claims, email_verified: true } : claims);
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

describe('OIDC sign-in to an account that has the address', () => {
  let provider: ReturnType<typeof Bun.serve>;

  beforeEach(async () => {
    await resetDb();
    provider = startProvider();
    withIdToken = false;
    const god = authedApi((await signUpTestUser({ name: 'Root' })).cookie);
    const oidc = await god.god['oidc-settings'].put({
      discoveryUrl: `http://localhost:${provider.port}/.well-known/openid-configuration`,
      clientId: 'itsaplan',
      clientSecret: 'client-secret',
      label: 'Test IdP',
      enabled: true,
    });
    expect(oidc.status).toBe(200);
    // The account confirms its address by a sign-in link, the way a person would.
    await setAuthSettings({ magicLink: true });
    await signUpTestUser({ email: profile.email, name: 'Owner' });
    await openMagicLink(profile.email, crypto.randomUUID());
  });

  afterEach(async () => {
    await provider.stop(true);
  });

  // The better-auth endpoints are not modelled by Eden Treaty, so they are driven
  // through the app handler. Returns who the round trip signed in, if anyone, and the
  // error it was sent back with.
  async function signInWithProvider(): Promise<{ email: string | null; error: string | null }> {
    const start = await app.handle(
      new Request('http://localhost/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: 'oidc', callbackURL: '/' }),
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
    const location = new URL(callback.headers.get('location') ?? '', 'http://localhost');
    const me = await authedApi(cookiesOf(callback)).me.get();
    return {
      email: me.data?.authenticated ? me.data.user.email : null,
      error: location.searchParams.get('error'),
    };
  }

  const refused = { email: null, error: 'account_not_linked' };

  it('refuses an address the provider reports unverified as the string "false"', async () => {
    emailVerified = 'false';

    expect(await signInWithProvider()).toEqual(refused);
  });

  it('refuses the string "false" in an id_token too', async () => {
    emailVerified = 'false';
    withIdToken = true;

    expect(await signInWithProvider()).toEqual(refused);
  });

  it('refuses an address the provider reports unverified as false', async () => {
    emailVerified = false;

    expect(await signInWithProvider()).toEqual(refused);
  });

  it('signs in when the provider reports the address verified as the string "true"', async () => {
    emailVerified = 'true';

    expect(await signInWithProvider()).toEqual({ email: profile.email, error: null });
  });
});
