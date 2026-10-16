import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../helpers/app';
import { signUpTestUser } from '../helpers/auth';
import { resetDb } from '../helpers/db';

describe('MCP authorization asks for consent', () => {
  beforeEach(resetDb);

  async function registerClient(): Promise<string> {
    const res = await app.handle(
      new Request('http://localhost/api/auth/oauth2/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          redirect_uris: ['https://client.example.com/callback'],
          token_endpoint_auth_method: 'none',
          client_name: 'Test client',
        }),
      }),
    );
    expect(res.status).toBe(201);
    return ((await res.json()) as { client_id: string }).client_id;
  }

  it('lets a client register without a session', async () => {
    expect(await registerClient()).toBeTruthy();
  });

  async function authorize(cookie?: string): Promise<URL> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: await registerClient(),
      redirect_uri: 'https://client.example.com/callback',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
      scope: 'openid',
      state: 'st',
    });
    const res = await app.handle(
      new Request(`http://localhost/api/auth/oauth2/authorize?${params}`, {
        headers: cookie ? { cookie } : {},
      }),
    );
    return new URL(res.headers.get('location') ?? '');
  }

  it('sends a signed-in person to the consent page instead of the client', async () => {
    const user = await signUpTestUser({ team: false });

    const location = await authorize(user.cookie);

    // The consent page carries the signed request, the client's redirect URI among it.
    expect(location.pathname).toBe('/oauth/consent');
    expect(location.host).not.toBe('client.example.com');
  });

  it('continues to the consent page once the person signs in', async () => {
    const user = await signUpTestUser({ team: false });
    const login = await authorize();
    expect(login.pathname).toBe('/login');

    // The sign-in screen posts the signed request it was sent with.
    const res = await app.handle(
      new Request('http://localhost/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: 'test-password-123',
          oauth_query: login.search.slice(1),
        }),
      }),
    );

    const { url } = (await res.json()) as { url: string };
    expect(new URL(url).pathname).toBe('/oauth/consent');
  });

  // The api cannot send this error back to a client it does not know, so the person sees
  // it: on the web's sign-in screen, in either form of API_URL.
  it('sends an authorization for an unknown client to the sign-in screen with the reason', async () => {
    const res = await app.handle(
      new Request(
        `http://localhost/api/auth/oauth2/authorize?${new URLSearchParams({
          response_type: 'code',
          client_id: 'no-such-client',
          redirect_uri: 'https://client.example.com/callback',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          code_challenge_method: 'S256',
          state: 'st',
        })}`,
      ),
    );

    const location = new URL(res.headers.get('location') ?? '');
    expect(`${location.origin}${location.pathname}`).toBe(`${process.env.APP_URL}/login`);
    expect(location.searchParams.get('error')).toBe('invalid_client');
  });

  async function authorizeWith(overrides: Record<string, string>): Promise<URL> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: await registerClient(),
      redirect_uri: 'https://client.example.com/callback',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
      state: 'st',
      ...overrides,
    });
    const res = await app.handle(
      new Request(`http://localhost/api/auth/oauth2/authorize?${params}`),
    );
    return new URL(res.headers.get('location') ?? '');
  }

  it('sends an authorization for an unregistered redirect URI to the sign-in screen', async () => {
    const location = await authorizeWith({ redirect_uri: 'https://other.example.com/callback' });

    expect(`${location.origin}${location.pathname}`).toBe(`${process.env.APP_URL}/login`);
    expect(location.searchParams.get('error')).toBe('invalid_redirect');
  });

  it('still answers the client an error it can send back', async () => {
    const location = await authorizeWith({ scope: 'no-such-scope' });

    expect(`${location.origin}${location.pathname}`).toBe('https://client.example.com/callback');
    expect(location.searchParams.get('error')).toBe('invalid_scope');
  });

  // The consent page names the client and where the answer goes from these.
  it('tells the consent page which client asks and where the answer goes', async () => {
    const user = await signUpTestUser({ team: false });

    const consentPage = await authorize(user.cookie);
    const clientId = consentPage.searchParams.get('client_id') ?? '';
    expect(consentPage.searchParams.get('redirect_uri')).toBe(
      'https://client.example.com/callback',
    );

    const res = await app.handle(
      new Request(`http://localhost/api/auth/oauth2/public-client?client_id=${clientId}`, {
        headers: { cookie: user.cookie },
      }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { client_name?: string }).client_name).toBe('Test client');
  });
});
