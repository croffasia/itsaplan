import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { app, authedApi } from '#tests/helpers/app';
import { openMagicLink, signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The web's sign-in page reads ?error= after a provider round trip, so the form of that
// parameter is the contract this pins: the registration gate's refusal code, on every
// sign-up path (see useRedirectError in the web).
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
          return Response.json({ access_token: 'token', token_type: 'Bearer', expires_in: 3600 });
        case '/userinfo':
          return Response.json({
            sub: 'idp-newcomer',
            email: 'newcomer@example.com',
            email_verified: true,
            name: 'Newcomer',
          });
        default:
          return new Response('Not found', { status: 404 });
      }
    },
  });
}

// Google's token endpoint is fixed, so its exchange is answered here. better-auth reads
// the profile from the id_token without verifying it on the callback.
const realFetch = globalThis.fetch;
function answerGoogleToken() {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const idToken = `${part({ alg: 'none' })}.${part({
    sub: 'google-newcomer',
    email: 'newcomer@example.com',
    email_verified: true,
    name: 'Newcomer',
  })}.`;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return Response.json({
        access_token: 'token',
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

function cookiesOf(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

describe('a sign-up the registration gate refuses', () => {
  let provider: ReturnType<typeof Bun.serve>;

  beforeEach(async () => {
    await resetDb();
    provider = startProvider();
  });

  afterEach(async () => {
    globalThis.fetch = realFetch;
    await provider.stop(true);
  });

  async function setUp(registration: 'invite' | 'closed') {
    const god = authedApi((await signUpTestUser({ name: 'Root' })).cookie);
    const google = await god.god['google-settings'].put({
      enabled: true,
      clientId: 'google-client',
      clientSecret: 'google-secret',
    });
    expect(google.status).toBe(200);
    const oidc = await god.god['oidc-settings'].put({
      discoveryUrl: `http://localhost:${provider.port}/.well-known/openid-configuration`,
      clientId: 'itsaplan',
      clientSecret: 'client-secret',
      label: 'Test IdP',
      enabled: true,
    });
    expect(oidc.status).toBe(200);
    expect((await god.god['auth-settings'].put({ registration })).status).toBe(200);
  }

  // The better-auth endpoints are not modelled by Eden Treaty, so they are driven
  // through the app handler.
  const routes = {
    oidc: {
      start: '/api/auth/sign-in/social',
      body: { provider: 'oidc', callbackURL: '/' },
      callback: '/api/auth/oauth2/callback/oidc',
    },
    google: {
      start: '/api/auth/sign-in/social',
      body: { provider: 'google', callbackURL: '/' },
      callback: '/api/auth/callback/google',
    },
  };

  async function errorAfterProvider(via: keyof typeof routes): Promise<string | null> {
    const route = routes[via];
    if (via === 'google') answerGoogleToken();
    const start = await app.handle(
      new Request(`http://localhost${route.start}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(route.body),
      }),
    );
    expect(start.status).toBe(200);
    const { url } = (await start.json()) as { url: string };
    const state = new URL(url).searchParams.get('state') ?? '';

    const callback = await app.handle(
      new Request(`http://localhost${route.callback}?code=code-1&state=${state}`, {
        headers: { cookie: cookiesOf(start) },
      }),
    );
    expect(callback.status).toBe(302);
    const location = new URL(callback.headers.get('location') ?? '', 'http://localhost');
    return location.searchParams.get('error');
  }

  for (const via of ['oidc', 'google'] as const) {
    it(`redirects a ${via} sign-up on a closed instance with REGISTRATION_CLOSED`, async () => {
      await setUp('closed');
      expect(await errorAfterProvider(via)).toBe('REGISTRATION_CLOSED');
    });

    it(`redirects a ${via} sign-up without an invite with INVITE_ONLY`, async () => {
      await setUp('invite');
      expect(await errorAfterProvider(via)).toBe('INVITE_ONLY');
    });
  }

  // The link is asked for from the sign-in page, which names itself as errorCallbackURL.
  it('sends a refused magic-link sign-up on a closed instance to sign-in with its code', async () => {
    await setUp('closed');
    const location = await openMagicLink('newcomer@example.com', 'magic-closed');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('REGISTRATION_CLOSED');
  });

  it('sends a refused magic-link sign-up without an invite to sign-in with its code', async () => {
    await setUp('invite');
    const location = await openMagicLink('newcomer@example.com', 'magic-stranger');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('INVITE_ONLY');
  });
});
