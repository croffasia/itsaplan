import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';

// The registrations below are what each client sends, from #563.
async function register(metadata: Record<string, unknown>) {
  const res = await app.handle(
    new Request('http://localhost/api/auth/oauth2/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token_endpoint_auth_method: 'none',
        client_name: 'Test',
        ...metadata,
      }),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('MCP client registration', () => {
  beforeEach(resetDb);

  it('registers a client with an http loopback callback, as Claude Code sends it', async () => {
    for (const host of ['127.0.0.1:33418', 'localhost:33418']) {
      const { status, body } = await register({ redirect_uris: [`http://${host}/callback`] });
      expect(status).toBe(201);
      expect(body).toMatchObject({ application_type: 'native' });
    }
  });

  it("registers Cursor's custom-scheme callback", async () => {
    const { status } = await register({
      redirect_uris: ['cursor://anysphere.cursor-mcp/oauth/callback'],
    });
    expect(status).toBe(201);
  });

  it("registers Claude's connector and keeps only the grants the server issues", async () => {
    const { status, body } = await register({
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      grant_types: [
        'authorization_code',
        'refresh_token',
        'urn:ietf:params:oauth:grant-type:jwt-bearer',
      ],
      response_types: ['code'],
    });
    expect(status).toBe(201);
    expect(body.grant_types).toEqual(['authorization_code', 'refresh_token']);
  });

  it('still registers an https callback that sends no application type', async () => {
    const { status } = await register({ redirect_uris: ['https://client.example.com/callback'] });
    expect(status).toBe(201);
  });

  it('refuses a loopback callback for a client that says it is a web app', async () => {
    const { status, body } = await register({
      redirect_uris: ['http://127.0.0.1:33418/callback'],
      application_type: 'web',
    });
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: 'invalid_redirect_uri' });
  });

  it('refuses an http callback outside loopback', async () => {
    const { status, body } = await register({
      redirect_uris: ['http://client.example.com/callback'],
    });
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: 'invalid_redirect_uri' });
  });

  it('refuses a registration that asks for no grant the server issues', async () => {
    const { status, body } = await register({
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      grant_types: ['urn:ietf:params:oauth:grant-type:jwt-bearer'],
    });
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: 'invalid_client_metadata' });
  });
});
