import { describe, expect, it } from 'bun:test';

// @repo/auth reads API_URL when it loads, so the app with a public path prefix is
// loaded in a process of its own, once for every request below.
const REQUESTS = [
  { method: 'GET', path: '/.well-known/oauth-authorization-server' },
  { method: 'GET', path: '/.well-known/oauth-protected-resource/mcp' },
  { method: 'GET', path: '/.well-known/oauth-authorization-server/api' },
  { method: 'GET', path: '/.well-known/openid-configuration' },
  { method: 'GET', path: '/.well-known/openid-configuration/api' },
  { method: 'GET', path: '/.well-known/oauth-protected-resource/api/mcp' },
  { method: 'POST', path: '/mcp' },
];

interface Answer {
  status: number;
  challenge: string | null;
  body: Record<string, unknown>;
}

async function discover(): Promise<Map<string, Answer>> {
  const script = `
    const { app } = await import('${new URL('../../../app.ts', import.meta.url).pathname}');
    const out = {};
    for (const { method, path } of ${JSON.stringify(REQUESTS)}) {
      const res = await app.handle(new Request('http://localhost' + path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) : undefined,
      }));
      out[method + ' ' + path] = {
        status: res.status,
        challenge: res.headers.get('www-authenticate'),
        body: await res.json(),
      };
    }
    console.log(JSON.stringify(out));
    process.exit(0);
  `;
  const proc = Bun.spawn([process.execPath, '-e', script], {
    env: { ...process.env, API_URL: 'https://example.test/api', APP_URL: 'https://example.test' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if ((await proc.exited) !== 0) throw new Error(err);
  return new Map(
    Object.entries(JSON.parse(out.trim().split('\n').pop()!) as Record<string, Answer>),
  );
}

let answers: Promise<Map<string, Answer>> | undefined;

// Loading the app takes a few seconds, so the first case to ask carries the load and
// gets the time for it.
async function answer(path: string, method = 'GET'): Promise<Answer> {
  return (await (answers ??= discover())).get(`${method} ${path}`)!;
}

const LOAD_TIMEOUT = 20_000;

describe('MCP discovery behind a public path prefix', () => {
  it(
    'points the authorization-server metadata at the public prefix',
    async () => {
      const res = await answer('/.well-known/oauth-authorization-server');

      expect(res!.status).toBe(200);
      expect(res!.body).toMatchObject({
        issuer: 'https://example.test/api',
        authorization_endpoint: 'https://example.test/api/api/auth/mcp/authorize',
        token_endpoint: 'https://example.test/api/api/auth/mcp/token',
        registration_endpoint: 'https://example.test/api/api/auth/mcp/register',
        jwks_uri: 'https://example.test/api/api/auth/mcp/jwks',
      });
    },
    LOAD_TIMEOUT,
  );

  it(
    'names the prefixed issuer as authorization server of the resource',
    async () => {
      const res = await answer('/.well-known/oauth-protected-resource/mcp');

      expect(res!.body).toMatchObject({
        resource: 'https://example.test/api/mcp',
        authorization_servers: ['https://example.test/api'],
      });
    },
    LOAD_TIMEOUT,
  );

  it(
    'answers the RFC 8414 and OpenID lookups of a prefixed issuer',
    async () => {
      const results = await Promise.all([
        answer('/.well-known/oauth-authorization-server/api'),
        answer('/.well-known/openid-configuration'),
        answer('/.well-known/openid-configuration/api'),
        answer('/.well-known/oauth-protected-resource/api/mcp'),
      ]);

      for (const res of results) expect(res.status).toBe(200);
      expect(results[0]!.body.issuer).toBe('https://example.test/api');
      expect(results[3]!.body.resource).toBe('https://example.test/api/mcp');
    },
    LOAD_TIMEOUT,
  );

  it(
    'challenges MCP clients with metadata reachable under the prefix',
    async () => {
      const res = await answer('/mcp', 'POST');

      const expected =
        'Bearer resource_metadata="https://example.test/api/.well-known/oauth-protected-resource/mcp"';
      expect(res!.status).toBe(401);
      expect(res!.challenge).toBe(expected);
      expect((res!.body.error as Record<string, unknown>)['www-authenticate']).toBe(expected);
    },
    LOAD_TIMEOUT,
  );

  it('passes through the null better-auth answers when it cannot build a document', async () => {
    const { withPublicDiscoveryUrls } = await import('@repo/auth');

    const res = await withPublicDiscoveryUrls(Response.json(null));

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});
