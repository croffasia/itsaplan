import { beforeEach, describe, expect, it } from 'bun:test';
import { db, session } from '@repo/db';
import { eq } from 'drizzle-orm';
import { app } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import {
  connectMcpClientTokens,
  mcpRpc,
  refreshMcpToken,
  registerMcpClient,
} from '#tests/helpers/mcp';

async function connect() {
  const ana = await signUpTestUser({ team: false });
  const clientId = await registerMcpClient();
  // offline_access gives the client a refresh token, as real MCP clients ask for.
  const tokens = await connectMcpClientTokens(ana.cookie, clientId, 'openid offline_access');
  expect(tokens.refresh_token).toBeString();
  return { ana, clientId, refreshToken: tokens.refresh_token! };
}

async function refreshedToken(clientId: string, refreshToken: string) {
  const res = await refreshMcpToken(clientId, refreshToken);
  expect(res.status).toBe(200);
  return ((await res.json()) as { access_token: string }).access_token;
}

describe('MCP OAuth refresh', () => {
  beforeEach(resetDb);

  it('leaves the open session that granted the token alone', async () => {
    const { ana, clientId, refreshToken } = await connect();

    const token = await refreshedToken(clientId, refreshToken);

    expect((await mcpRpc(token, 'tools/list')).tools).toBeDefined();
    const res = await app.handle(
      new Request('http://localhost/api/auth/get-session', { headers: { cookie: ana.cookie } }),
    );
    expect(await res.json()).toMatchObject({ user: { id: ana.userId } });
  });

  it('issues a working token after that session has expired', async () => {
    const { ana, clientId, refreshToken } = await connect();
    await db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(session.userId, ana.userId));

    const token = await refreshedToken(clientId, refreshToken);

    expect((await mcpRpc(token, 'tools/list')).tools).toBeDefined();
  });
});
