import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../../../__tests__/helpers/app';
import { resetDb } from '#tests/helpers/db';

describe('MCP OAuth discovery', () => {
  it('publishes authorization-server metadata', async () => {
    const response = await app.handle(
      new Request('http://localhost/.well-known/oauth-authorization-server'),
    );

    expect(response.status).toBe(200);
    const metadata = (await response.json()) as Record<string, unknown>;
    expect(typeof metadata.authorization_endpoint).toBe('string');
    expect(typeof metadata.token_endpoint).toBe('string');
    expect(typeof metadata.registration_endpoint).toBe('string');
  });

  it('challenges unauthenticated MCP clients with resource metadata', async () => {
    const response = await app.handle(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata');
  });

  it('does not accept an OAuth token sent through a direct route header', async () => {
    const response = await app.handle(
      new Request('http://localhost/projects', {
        headers: {
          'x-mcp-loopback': '1',
          'x-mcp-oauth-token': 'forged',
        },
      }),
    );

    expect(response.status).toBe(401);
  });
});

describe('MCP client registration', () => {
  beforeEach(resetDb);

  async function register(body: Record<string, unknown>) {
    const response = await app.handle(
      new Request('http://localhost/api/auth/mcp/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          redirect_uris: ['https://client.example/callback'],
          token_endpoint_auth_method: 'none',
          ...body,
        }),
      }),
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it('names a client that registers without a name', async () => {
    const res = await register({});

    expect(res.status).toBe(201);
    expect(res.body.client_name).toBe('MCP client');
  });

  it('keeps the name a client registers with', async () => {
    const res = await register({ client_name: 'Claude' });

    expect(res.status).toBe(201);
    expect(res.body.client_name).toBe('Claude');
  });
});
