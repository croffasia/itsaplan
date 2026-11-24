import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { setAuthSettings } from '@repo/auth';
import { app, authedApi } from '#tests/helpers/app';
import { openMagicLink, signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// An OIDC sign-in whose address already has a confirmed account signs into it only
// when the provider says it verified the address. Some providers send the claim as a
// string (Amazon Cognito's userinfo does), and a string "false" must not count as
// verified, or anyone who can hold an unverified address at the provider takes the
// account that has it. A profile also has to be for the subject of the provider's
// signed id_token.
const profile = { sub: 'idp-someone', email: 'owner@example.com', name: 'Someone' };
const clientId = 'itsaplan';

// What the provider says about the address, and whether it says it in an id_token or
// only from its userinfo endpoint.
let emailVerified: unknown;
let withIdToken = false;

// A provider that publishes its keys signs the id_token, and better-auth verifies it.
// The id_token then names the subject, and userinfo, which it reads for the address,
// answers with `userinfoSubject`.
let signed = false;
let userinfoSubject = profile.sub;
let nonce: string | null = null;
const signingKey = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
);
const publicJwk = { ...(await crypto.subtle.exportKey('jwk', signingKey.publicKey)), kid: 'k1' };

const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

function unsignedIdToken(claims: object): string {
  return `${part({ alg: 'none' })}.${part(claims)}.`;
}

async function signedIdToken(claims: object): Promise<string> {
  const input = `${part({ alg: 'RS256', kid: 'k1', typ: 'JWT' })}.${part(claims)}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    signingKey.privateKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${Buffer.from(signature).toString('base64url')}`;
}

async function idTokenFor(issuer: string, claims: object): Promise<string | undefined> {
  if (signed) {
    const now = Math.floor(Date.now() / 1000);
    return signedIdToken({
      sub: profile.sub,
      iss: issuer,
      aud: clientId,
      iat: now,
      exp: now + 300,
      nonce,
    });
  }
  if (withIdToken) return unsignedIdToken(claims);
  return undefined;
}

function startProvider() {
  return Bun.serve({
    port: 0,
    async fetch(req) {
      const { origin, pathname } = new URL(req.url);
      const claims = { ...profile, email_verified: emailVerified };
      switch (pathname) {
        case '/.well-known/openid-configuration':
          return Response.json({
            issuer: origin,
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            userinfo_endpoint: `${origin}/userinfo`,
            ...(signed
              ? { jwks_uri: `${origin}/jwks`, id_token_signing_alg_values_supported: ['RS256'] }
              : {}),
          });
        case '/jwks':
          return Response.json({ keys: [publicJwk] });
        case '/token': {
          const idToken = await idTokenFor(origin, claims);
          return Response.json({
            access_token: 'token',
            token_type: 'Bearer',
            expires_in: 3600,
            ...(idToken ? { id_token: idToken } : {}),
          });
        }
        case '/userinfo':
          if (signed) return Response.json({ ...claims, sub: userinfoSubject });
          // With an unsigned id_token, userinfo says the opposite, so a test passes only
          // if the id_token is what was read.
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
    emailVerified = undefined;
    withIdToken = false;
    signed = false;
    userinfoSubject = profile.sub;
    nonce = null;
    const god = authedApi((await signUpTestUser({ name: 'Root' })).cookie);
    const oidc = await god.god['oidc-settings'].put({
      // The api keeps the provider it built for unchanged settings, and a port can come
      // back; a fresh URL makes it read this test's discovery document.
      discoveryUrl: `http://localhost:${provider.port}/.well-known/openid-configuration?run=${crypto.randomUUID()}`,
      clientId,
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
    nonce = new URL(url).searchParams.get('nonce');
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

  // The id_token is what the provider signed; userinfo is fetched with an access token.
  // A profile for another subject would attach that identity to the account.
  it('signs in when userinfo names the subject of the signed id_token', async () => {
    emailVerified = true;
    signed = true;

    expect(await signInWithProvider()).toEqual({ email: profile.email, error: null });
  });

  it('refuses a userinfo profile for another subject than the signed id_token', async () => {
    emailVerified = true;
    signed = true;
    userinfoSubject = 'idp-someone-else';

    expect(await signInWithProvider()).toEqual({ email: null, error: 'unable_to_get_user_info' });
  });
});
