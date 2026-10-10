import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../helpers/app';
import { signUpTestUser } from '../helpers/auth';
import { resetDb } from '../helpers/db';

describe('MCP authorization always asks for consent', () => {
  beforeEach(resetDb);

  async function registerClient(): Promise<string> {
    const res = await app.handle(
      new Request('http://localhost/api/auth/mcp/register', {
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

  it('sends a signed-in person to the consent page instead of the client', async () => {
    const user = await signUpTestUser({ team: false });
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
      new Request(`http://localhost/api/auth/mcp/authorize?${params}`, {
        headers: { cookie: user.cookie },
      }),
    );

    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/oauth/consent');
    expect(location).not.toContain('client.example.com');
  });
});
