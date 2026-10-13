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
});
