import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createHash } from 'node:crypto';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createCredential } from '#tests/helpers/integrations';
import { buildCustomTools } from '#modules/agents/core/runtime/tools/custom-tools';

// The SSRF guard refuses http and loopback hosts under NODE_ENV=test, so each case runs
// as development, the way the @repo/net tests reach a local server.

const environment = { NODE_ENV: process.env.NODE_ENV };

// tools/call answers as an SSE stream with a notification before the answer.
function fakeMcpServer() {
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      if (req.headers.get('authorization') !== 'Bearer t0k') {
        return new Response('unauthorized', { status: 401 });
      }
      const msg = (await req.json()) as {
        id?: number;
        method: string;
        params?: Record<string, unknown>;
      };
      if (msg.id === undefined) return new Response(null, { status: 202 });
      const answer = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id, result });
      if (msg.method === 'initialize') {
        return Response.json(answer({ protocolVersion: '2025-06-18', capabilities: {} }), {
          headers: { 'mcp-session-id': 's-1' },
        });
      }
      if (req.headers.get('mcp-session-id') !== 's-1') {
        return new Response('no session', { status: 400 });
      }
      if (msg.method === 'tools/list') {
        const page = msg.params?.cursor
          ? { tools: [{ name: 'fail', inputSchema: { type: 'object' } }] }
          : {
              tools: [
                {
                  name: 'echo',
                  title: 'Echo',
                  description: 'Echoes the text.',
                  inputSchema: {
                    type: 'object',
                    properties: { text: { type: 'string' } },
                    required: ['text'],
                  },
                },
              ],
              nextCursor: 'p2',
            };
        return Response.json(answer(page));
      }
      if (msg.method === 'tools/call') {
        const { name, arguments: args } = msg.params as {
          name: string;
          arguments: { text?: string };
        };
        const result =
          name === 'echo'
            ? { content: [], structuredContent: { echoed: args.text } }
            : { content: [{ type: 'text', text: 'it broke' }], isError: true };
        const progress = { jsonrpc: '2.0', method: 'notifications/progress', params: {} };
        return new Response(
          `data: ${JSON.stringify(progress)}\n\ndata: ${JSON.stringify(answer(result))}\n\n`,
          { headers: { 'content-type': 'text/event-stream' } },
        );
      }
      return Response.json({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'no' } });
    },
  });
  return { url: `http://localhost:${server.port}/mcp`, stop: () => server.stop(true) };
}

// The first access token is issued already expired, so the first use renews it.
function fakeOAuthMcpServer() {
  const state = { challenge: '', latest: '', issued: 0, refreshes: 0 };
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const origin = url.origin;
      if (url.pathname === '/.well-known/oauth-protected-resource') {
        return Response.json({
          resource: `${origin}/mcp`,
          authorization_servers: [origin],
          scopes_supported: ['mcp'],
        });
      }
      if (url.pathname === '/.well-known/oauth-authorization-server') {
        return Response.json({
          issuer: origin,
          authorization_endpoint: `${origin}/authorize`,
          token_endpoint: `${origin}/token`,
          registration_endpoint: `${origin}/register`,
        });
      }
      if (url.pathname === '/register') return Response.json({ client_id: 'client-1' });
      if (url.pathname === '/token') {
        const form = new URLSearchParams(await req.text());
        if (form.get('client_id') !== 'client-1' || form.get('resource') !== `${origin}/mcp`) {
          return Response.json({ error: 'invalid_client' }, { status: 401 });
        }
        if (form.get('grant_type') === 'authorization_code') {
          const verifier = form.get('code_verifier') ?? '';
          const challenge = createHash('sha256').update(verifier).digest('base64url');
          if (form.get('code') !== 'code-1' || challenge !== state.challenge) {
            return Response.json({ error: 'invalid_grant' }, { status: 400 });
          }
          state.latest = `at-${++state.issued}`;
          return Response.json({
            access_token: state.latest,
            refresh_token: 'rt-1',
            expires_in: 0,
          });
        }
        if (form.get('refresh_token') !== 'rt-1') {
          return Response.json({ error: 'invalid_grant' }, { status: 400 });
        }
        state.refreshes++;
        state.latest = `at-${++state.issued}`;
        return Response.json({ access_token: state.latest, expires_in: 3600 });
      }
      if (url.pathname !== '/mcp') return new Response('not found', { status: 404 });
      if (!state.latest || req.headers.get('authorization') !== `Bearer ${state.latest}`) {
        return new Response(null, { status: 401, headers: { 'www-authenticate': 'Bearer' } });
      }
      const msg = (await req.json()) as { id?: number; method: string };
      if (msg.id === undefined) return new Response(null, { status: 202 });
      const result =
        msg.method === 'tools/list'
          ? { tools: [{ name: 'echo', inputSchema: { type: 'object' } }] }
          : { protocolVersion: '2025-06-18', capabilities: {} };
      return Response.json({ jsonrpc: '2.0', id: msg.id, result });
    },
  });
  return { url: `http://localhost:${server.port}/mcp`, state, stop: () => server.stop(true) };
}

let fake: ReturnType<typeof fakeMcpServer> | null = null;

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  return { asOwner, teamId: project.data!.teamId };
}

const mcpCredential = (url: string, headerValue = 'Bearer t0k') => ({
  integrationKey: 'mcp',
  label: 'Internal',
  credential: { url, headerValue },
});

const mcpTools = (api: Api, teamId: number, credentialId: number) =>
  api.teams({ teamId }).integrations({ credentialId })['mcp-tools'].get();

describe('MCP servers', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.NODE_ENV = 'development';
    fake = fakeMcpServer();
  });

  afterEach(() => {
    fake?.stop();
    fake = null;
    process.env.NODE_ENV = environment.NODE_ENV;
  });

  it('stores a credential the server accepts', async () => {
    const { asOwner, teamId } = await setup();
    const res = await asOwner.teams({ teamId }).integrations.post(mcpCredential(fake!.url));
    expect(res.status).toBe(201);
    expect(res.data?.redacted).toEqual({ url: fake!.url, headerValue: '•••• t0k' });
  });

  it('refuses a credential the server rejects', async () => {
    const { asOwner, teamId } = await setup();
    const res = await asOwner
      .teams({ teamId })
      .integrations.post(mcpCredential(fake!.url, 'Bearer wrong'));
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.error?.value)).toContain('asks for authorization');
  });

  it('lists the tools of every page under their configured-tool keys', async () => {
    const { asOwner, teamId } = await setup();
    const credentialId = await createCredential(asOwner, 'MKT', mcpCredential(fake!.url));
    const res = await mcpTools(asOwner, teamId, credentialId);
    expect(res.status).toBe(200);
    expect(res.data).toEqual([
      { key: 'mcp:echo', label: 'Echo', description: 'Echoes the text.' },
      { key: 'mcp:fail', label: 'fail', description: '' },
    ]);
  });

  it('answers 404 for a credential that is not an MCP server', async () => {
    const { asOwner, teamId } = await setup();
    const jinaId = await createCredential(asOwner, 'MKT', {
      integrationKey: 'jina',
      credential: { apiKey: 'jina-key-1234' },
    });
    const res = await mcpTools(asOwner, teamId, jinaId);
    expect(res.status).toBe(404);
  });

  it('configures a tool the server offers and refuses one it does not', async () => {
    const { asOwner, teamId } = await setup();
    const credentialId = await createCredential(asOwner, 'MKT', mcpCredential(fake!.url));
    const tools = asOwner.teams({ teamId })['agent-tools'];

    const ok = await tools.post({ toolKey: 'mcp:echo', credentialId });
    expect(ok.status).toBe(201);
    expect(ok.data).toMatchObject({ toolKey: 'mcp:echo', integrationKey: 'mcp' });

    const missing = await tools.post({ toolKey: 'mcp:nope', credentialId });
    expect(missing.status).toBe(400);

    const jinaId = await createCredential(asOwner, 'MKT', {
      integrationKey: 'jina',
      credential: { apiKey: 'jina-key-1234' },
    });
    const wrong = await tools.post({ toolKey: 'mcp:echo', credentialId: jinaId });
    expect(wrong.status).toBe(400);
  });

  it('builds runtime tools that call the server', async () => {
    const credential = { url: fake!.url, headerValue: 'Bearer t0k' };
    const tools = await buildCustomTools([
      { id: 1, toolKey: 'mcp:echo', credentialId: 7, credential },
      { id: 2, toolKey: 'mcp:fail', credentialId: 7, credential },
      { id: 3, toolKey: 'mcp:gone', credentialId: 7, credential },
    ]);
    expect(Object.keys(tools).sort()).toEqual(['mcp_echo', 'mcp_fail']);
    expect(await tools.mcp_echo!.execute!({ text: 'hi' }, {} as never)).toEqual({ echoed: 'hi' });
    expect(await tools.mcp_fail!.execute!({}, {} as never)).toEqual({ error: 'it broke' });
  });

  it('builds no tools for a server it cannot reach', async () => {
    const url = fake!.url;
    fake!.stop();
    const tools = await buildCustomTools([
      { id: 1, toolKey: 'mcp:echo', credentialId: 7, credential: { url } },
    ]);
    expect(tools).toEqual({});
  });

  describe('OAuth sign-in', () => {
    let oauth: ReturnType<typeof fakeOAuthMcpServer>;

    beforeEach(() => {
      oauth = fakeOAuthMcpServer();
    });

    afterEach(() => {
      oauth.stop();
    });

    async function storedServer() {
      const { asOwner, teamId } = await setup();
      const credentialId = await createCredential(asOwner, 'MKT', {
        integrationKey: 'mcp',
        credential: { url: oauth.url },
      });
      return { asOwner, teamId, credentialId };
    }

    const signIn = (api: Api, teamId: number, credentialId: number) =>
      api.teams({ teamId }).integrations({ credentialId })['mcp-sign-in'].post();

    const callback = (api: Api, query: Record<string, string>) =>
      api.integrations.mcp.callback.get({ query });

    it('stores a server that asks for a sign-in and lists no tools until it is connected', async () => {
      const { asOwner, teamId, credentialId } = await storedServer();
      const res = await mcpTools(asOwner, teamId, credentialId);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.error?.value)).toContain('connect it first');
    });

    it('signs in with PKCE, stores the tokens, and renews an expired one once', async () => {
      const { asOwner, teamId, credentialId } = await storedServer();
      const started = await signIn(asOwner, teamId, credentialId);
      expect(started.status).toBe(200);
      const authorize = new URL(started.data!.url);
      expect(authorize.pathname).toBe('/authorize');
      expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
        response_type: 'code',
        client_id: 'client-1',
        code_challenge_method: 'S256',
        redirect_uri: `${process.env.API_URL}/integrations/mcp/callback`,
        resource: oauth.url,
        scope: 'mcp',
      });
      oauth.state.challenge = authorize.searchParams.get('code_challenge')!;

      const back = await callback(asOwner, {
        code: 'code-1',
        state: authorize.searchParams.get('state')!,
      });
      expect(back.status).toBe(302);
      const location = new URL(back.response.headers.get('location')!);
      expect(location.pathname).toEndWith('/settings/integrations');
      expect(location.searchParams.get('mcp_error')).toBeNull();

      const list = await asOwner.teams({ teamId }).integrations.get();
      expect(list.data?.items[0]?.redacted).toMatchObject({ oauth: 'connected' });

      const tools = await mcpTools(asOwner, teamId, credentialId);
      expect(tools.status).toBe(200);
      expect(tools.data).toEqual([{ key: 'mcp:echo', label: 'echo', description: '' }]);
      expect(oauth.state.refreshes).toBe(1);

      await mcpTools(asOwner, teamId, credentialId);
      expect(oauth.state.refreshes).toBe(1);
    });

    it('sends a declined sign-in back with the reason', async () => {
      const { asOwner, teamId, credentialId } = await storedServer();
      const started = await signIn(asOwner, teamId, credentialId);
      const state = new URL(started.data!.url).searchParams.get('state')!;
      const back = await callback(asOwner, { state, error: 'access_denied' });
      expect(back.status).toBe(302);
      const location = new URL(back.response.headers.get('location')!);
      expect(location.searchParams.get('mcp_error')).toBe('access_denied');
    });

    it('refuses a callback from an account other than the one that started the sign-in', async () => {
      const { asOwner, teamId, credentialId } = await storedServer();
      const started = await signIn(asOwner, teamId, credentialId);
      const authorize = new URL(started.data!.url);
      oauth.state.challenge = authorize.searchParams.get('code_challenge')!;
      const other = authedApi((await signUpTestUser()).cookie);
      const back = await callback(other, {
        code: 'code-1',
        state: authorize.searchParams.get('state')!,
      });
      expect(back.status).toBe(403);
      const list = await asOwner.teams({ teamId }).integrations.get();
      expect(list.data?.items[0]?.redacted).not.toHaveProperty('oauth');
    });

    it('refuses a forged state', async () => {
      const { asOwner } = await storedServer();
      const back = await callback(asOwner, { code: 'code-1', state: 'a.b.c' });
      expect(back.status).toBe(400);
    });

    it('answers 404 when signing in to a credential that is not an MCP server', async () => {
      const { asOwner, teamId } = await setup();
      const jinaId = await createCredential(asOwner, 'MKT', {
        integrationKey: 'jina',
        credential: { apiKey: 'jina-key-1234' },
      });
      expect((await signIn(asOwner, teamId, jinaId)).status).toBe(404);
    });
  });
});
