import { beforeEach, describe, expect, it } from 'bun:test';
import { resetDb } from '#tests/helpers/db';

// The URLs are read from the environment when @repo/auth loads, so each case runs its
// script in a process of its own. The script prints one JSON line.
async function runAuth(env: Record<string, string>, script: string) {
  const proc = Bun.spawn([process.execPath, '-e', `${script}\nprocess.exit(0);`], {
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if ((await proc.exited) !== 0) throw new Error(err);
  return JSON.parse(out.trim().split('\n').pop()!);
}

const ERROR_URL = `
  const { auth } = await import('@repo/auth');
  console.log(JSON.stringify({ errorURL: auth.options.onAPIError?.errorURL ?? null }));
`;

// Starts the Google and the OIDC sign-in, and reads the redirect URI each authorization
// URL carries. The OIDC provider only has to answer its discovery document.
const REDIRECT_URIS = `
  const { auth, setGoogleSettings, setOidcSettings } = await import('@repo/auth');
  const idp = Bun.serve({
    port: 0,
    fetch: (req) => {
      const { origin } = new URL(req.url);
      return Response.json({
        issuer: origin,
        authorization_endpoint: origin + '/authorize',
        token_endpoint: origin + '/token',
      });
    },
  });
  await setGoogleSettings({ enabled: true, clientId: 'google-client', clientSecret: 'secret' });
  await setOidcSettings({
    enabled: true,
    discoveryUrl: 'http://localhost:' + idp.port + '/.well-known/openid-configuration',
    clientId: 'oidc-client',
    clientSecret: 'secret',
  });
  const start = async (path, body) => {
    const res = await auth.handler(
      new Request(new URL(process.env.API_URL).origin + '/api/auth' + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    return new URL((await res.json()).url).searchParams.get('redirect_uri');
  };
  console.log(JSON.stringify({
    google: await start('/sign-in/social', { provider: 'google' }),
    oidc: await start('/sign-in/oauth2', { providerId: 'oidc' }),
  }));
`;

// Sends the three authentication emails and reads the link each one carries. The mail
// provider is Resend, whose API call is caught here instead of reaching the network.
const EMAIL_LINKS = `
  const { auth, setEmailSettings, setAuthSettings } = await import('@repo/auth');
  await setEmailSettings({ resend: { enabled: true, apiKey: 're_test' }, from: 'noreply@example.test' });
  await setAuthSettings({ magicLink: true, requireEmailVerification: true });
  const links = {};
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://api.resend.com/')) return realFetch(url, init);
    const mail = JSON.parse(init.body);
    links[mail.subject] = mail.text.match(/https?:\\/\\/\\S+/)[0];
    return Response.json({ id: 'sent' });
  };
  const post = (path, body) =>
    auth.handler(
      new Request(new URL(process.env.API_URL).origin + '/api/auth' + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  await post('/sign-up/email', { email: 'user@example.test', password: 'test-password-123', name: 'User' });
  await post('/sign-in/magic-link', { email: 'user@example.test' });
  await post('/request-password-reset', { email: 'user@example.test', redirectTo: '/reset-password' });
  for (let i = 0; i < 50 && Object.keys(links).length < 3; i++) await Bun.sleep(100);
  console.log(JSON.stringify(links));
`;

describe('auth URLs from the environment', () => {
  beforeEach(resetDb);

  it('leaves better-auth its own error page when API_URL has no path', async () => {
    const loaded = await runAuth(
      { API_URL: 'http://localhost:3000/', APP_URL: 'http://app.test' },
      ERROR_URL,
    );

    expect(loaded.errorURL).toBeNull();
  });

  it('sends early OAuth failures to the sign-in page when API_URL has a path', async () => {
    const loaded = await runAuth(
      { API_URL: 'https://example.test/api', APP_URL: 'https://example.test/' },
      ERROR_URL,
    );

    expect(loaded.errorURL).toBe('https://example.test/login');
  });

  it('puts the path of API_URL in the redirect URIs sent to Google and the OIDC provider', async () => {
    const uris = await runAuth(
      { API_URL: 'https://example.test/api', APP_URL: 'https://example.test' },
      REDIRECT_URIS,
    );

    expect(uris).toEqual({
      google: 'https://example.test/api/api/auth/callback/google',
      oidc: 'https://example.test/api/api/auth/oauth2/callback/oidc',
    });
  });

  it('puts the path of API_URL in the links of the authentication emails', async () => {
    const links = await runAuth(
      { API_URL: 'https://example.test/api', APP_URL: 'https://example.test' },
      EMAIL_LINKS,
    );

    expect(Object.keys(links).sort()).toEqual([
      'Confirm your email address',
      'Reset your password',
      'Your sign-in link',
    ]);
    for (const link of Object.values(links)) {
      expect(link).toStartWith('https://example.test/api/api/auth/');
    }
  });

  it('refuses to start with an API_URL that is not a URL', async () => {
    await expect(
      runAuth({ API_URL: 'not a url', APP_URL: 'http://app.test' }, ERROR_URL),
    ).rejects.toThrow('API_URL is not a valid URL: not a url');
  });
});
