import { describe, expect, it, beforeEach } from 'bun:test';
import { auth } from '@repo/auth';
import { apikey, db } from '@repo/db';
import { eq } from 'drizzle-orm';
import { app } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { signUpTestUser } from '#tests/helpers/auth';
import { patchOps, setupScim } from '#modules/scim/__tests__/helpers';

// The MCP endpoint resolves the API key itself instead of going through
// authContext, so the rules that gate a planner route have to hold here too.

async function rpc(apiKey: string, method: string, params: Record<string, unknown>) {
  return app.handle(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
}

function initialize(apiKey: string) {
  return rpc(apiKey, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  });
}

function listProjects(apiKey: string) {
  return rpc(apiKey, 'tools/call', { name: 'list_projects', arguments: {} });
}

// A key that allows `max` requests in a window long enough that no test outlasts it.
async function keyWithLimit(max: number) {
  const user = await signUpTestUser();
  const created = await auth.api.createApiKey({ body: { userId: user.userId, name: 'mcp' } });
  await db
    .update(apikey)
    .set({ rateLimitMax: max, rateLimitTimeWindow: 60_000 })
    .where(eq(apikey.id, created.id));
  return created.key;
}

describe('MCP authentication', () => {
  beforeEach(resetDb);

  it('refuses a request with no key', async () => {
    const res = await app.handle(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it('refuses a key whose account was deactivated over SCIM', async () => {
    const { scim } = await setupScim();
    const member = await signUpTestUser({ email: 'member@example.com' });
    const created = await auth.api.createApiKey({
      body: { userId: member.userId, name: 'mcp' },
    });

    expect((await initialize(created.key)).status).not.toBe(401);

    await scim.scim.v2
      .Users({ id: member.userId })
      .patch(patchOps([{ op: 'replace', path: 'active', value: false }]));

    expect((await initialize(created.key)).status).toBe(401);
  });

  it('counts a tool call once against the key rate limit', async () => {
    const key = await keyWithLimit(2);

    for (let i = 0; i < 2; i++) {
      const res = await listProjects(key);
      expect(res.status).toBe(200);
      // The transport answers over SSE: one `data:` line carrying the JSON-RPC response.
      const text = await res.text();
      expect(JSON.parse(text.slice(text.indexOf('data: ') + 6)).result.isError).not.toBe(true);
    }
  });

  it('answers a rate-limited key with 429 and Retry-After', async () => {
    const key = await keyWithLimit(1);
    expect((await initialize(key)).status).toBe(200);

    const res = await initialize(key);

    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(55);
    expect(Number(res.headers.get('retry-after'))).toBeLessThanOrEqual(60);
  });
});
