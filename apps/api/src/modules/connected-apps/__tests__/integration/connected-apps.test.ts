import { beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { app } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import {
  authorizeMcpClient,
  connectMcpClient,
  exchangeMcpCode,
  registerMcpClient,
  untaggedRoutes,
} from '#tests/helpers/mcp';
import { setMcpOAuthToken } from '#shared/mcp-request';

// offline_access gives the client a refresh token, as real MCP clients ask for.
const connect = (cookie: string, clientId: string) =>
  connectMcpClient(cookie, clientId, 'openid offline_access');

function mcpCall(bearer: string) {
  return app.handle(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        },
      }),
    }),
  );
}

function call(path: string, init: RequestInit & { cookie: string }) {
  const { cookie, headers, ...rest } = init;
  return app.handle(
    new Request(`http://localhost${path}`, {
      ...rest,
      headers: { cookie, ...(headers as Record<string, string>) },
    }),
  );
}

describe('connected applications', () => {
  beforeEach(resetDb);

  it('lists the applications the person authorized, and only theirs', async () => {
    const ana = await signUpTestUser({ team: false });
    const luis = await signUpTestUser({ team: false });
    const claude = await registerMcpClient('Claude');
    const chatgpt = await registerMcpClient('ChatGPT');
    await connect(ana.cookie, claude);
    await connect(luis.cookie, chatgpt);

    const res = await call('/account/connected-apps', { cookie: ana.cookie });

    expect(res.status).toBe(200);
    const apps = (await res.json()) as { clientId: string; name: string; scopes: string[] }[];
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ clientId: claude, name: 'Claude' });
    expect(apps[0]!.scopes).toEqual(expect.arrayContaining(['openid', 'offline_access']));
  });

  it('cuts an application off: its token stops working at once', async () => {
    const ana = await signUpTestUser({ team: false });
    const claude = await registerMcpClient('Claude');
    const token = await connect(ana.cookie, claude);
    expect((await mcpCall(token)).status).toBe(200);

    const res = await call(`/account/connected-apps/${claude}`, {
      method: 'DELETE',
      cookie: ana.cookie,
    });

    expect(res.status).toBe(204);
    expect((await mcpCall(token)).status).toBe(401);
    const left = await call('/account/connected-apps', { cookie: ana.cookie });
    expect(await left.json()).toEqual([]);
  });

  it('asks for consent again when the application connects again', async () => {
    const ana = await signUpTestUser({ team: false });
    const claude = await registerMcpClient('Claude');
    await connect(ana.cookie, claude);
    // With the consent standing, authorize sends the person straight back to the client.
    expect((await authorizeMcpClient(ana.cookie, claude)).searchParams.has('code')).toBe(true);

    await call(`/account/connected-apps/${claude}`, { method: 'DELETE', cookie: ana.cookie });

    // The registration stays, since other people may use it; the consent does not.
    const next = await authorizeMcpClient(ana.cookie, claude);
    expect(next.searchParams.has('code')).toBe(false);
    expect(next.searchParams.get('client_id')).toBe(claude);
  });

  it('refuses a code issued before the disconnection', async () => {
    const ana = await signUpTestUser({ team: false });
    const claude = await registerMcpClient('Claude');
    await connect(ana.cookie, claude);
    // Authorize again while connected: the code comes straight back, still unexchanged.
    const pending = await authorizeMcpClient(ana.cookie, claude);

    await call(`/account/connected-apps/${claude}`, { method: 'DELETE', cookie: ana.cookie });

    const res = await exchangeMcpCode(claude, pending.searchParams.get('code') ?? '');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' });
    const left = await call('/account/connected-apps', { cookie: ana.cookie });
    expect(await left.json()).toEqual([]);
  });

  it("leaves another person's connection to the same application alone", async () => {
    const ana = await signUpTestUser({ team: false });
    const luis = await signUpTestUser({ team: false });
    const claude = await registerMcpClient('Claude');
    await connect(ana.cookie, claude);
    const luisToken = await connect(luis.cookie, claude);

    await call(`/account/connected-apps/${claude}`, { method: 'DELETE', cookie: ana.cookie });

    const res = await call('/account/connected-apps', { cookie: luis.cookie });
    expect(((await res.json()) as unknown[]).length).toBe(1);
    expect((await mcpCall(luisToken)).status).toBe(200);
  });

  it('answers 404 for an application that is not connected', async () => {
    const ana = await signUpTestUser({ team: false });

    const res = await call('/account/connected-apps/nobody', {
      method: 'DELETE',
      cookie: ana.cookie,
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Application not connected' });
  });

  it('refuses an API key', async () => {
    const ana = await signUpTestUser({ team: false });
    const key = await auth.api.createApiKey({ body: { userId: ana.userId, name: 'script' } });

    const res = await app.handle(
      new Request('http://localhost/account/connected-apps', {
        headers: { 'x-api-key': key.key },
      }),
    );

    expect(res.status).toBe(403);
  });

  it('keeps both routes out of the MCP tools', () => {
    expect(untaggedRoutes((route) => route.includes('/account/connected-apps'))).toEqual([
      'GET /account/connected-apps',
      'DELETE /account/connected-apps/:clientId',
    ]);
  });

  it('refuses an OAuth token, so a connected agent cannot see or revoke the others', async () => {
    const ana = await signUpTestUser({ team: false });
    const token = await connect(ana.cookie, await registerMcpClient('Claude'));

    // How an MCP tool call reaches a route: the token rides on the request object.
    const request = new Request('http://localhost/account/connected-apps');
    setMcpOAuthToken(request, token);
    const res = await app.handle(request);

    expect(res.status).toBe(403);
  });
});
