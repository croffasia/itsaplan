import { describe, expect, it } from 'bun:test';
import { app } from '../../../__tests__/helpers/app';

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
