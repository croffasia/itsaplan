import { describe, expect, it, beforeEach } from 'bun:test';
import { auth } from '@repo/auth';
import { app } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { signUpTestUser } from '#tests/helpers/auth';
import { patchOps, setupScim } from '#modules/scim/__tests__/helpers';

// The MCP endpoint resolves the API key itself instead of going through
// authContext, so the rules that gate a planner route have to hold here too.

async function initialize(apiKey: string) {
  return app.handle(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        },
      }),
    }),
  );
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
});
