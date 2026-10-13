import { beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { apiKeyApi, app, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { setupScim } from '#modules/scim/__tests__/helpers';
import { createAgentUser, setup } from '../helpers';

const PASSWORD = 'test-password-123';

async function signIn(email: string) {
  return auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  });
}

const REDIRECT_URI = 'https://client.example.com/callback';
const MCP_RESOURCE = `${process.env.API_URL}/mcp`;
// The RFC 7636 example pair: the challenge is the S256 of the verifier.
const CODE_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CODE_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

// The MCP OAuth token a person gets by approving a client: register, authorize with
// their session, consent, and exchange the code.
async function mcpAccessToken(cookie: string): Promise<string> {
  const registered = await app.handle(
    new Request('http://localhost/api/auth/oauth2/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: 'none',
        client_name: 'Test client',
      }),
    }),
  );
  const clientId = ((await registered.json()) as { client_id: string }).client_id;
  const authorize = await app.handle(
    new Request(
      `http://localhost/api/auth/oauth2/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: 'S256',
        scope: 'openid',
        state: 'st',
        resource: MCP_RESOURCE,
      })}`,
      { headers: { cookie } },
    ),
  );
  // The consent page receives the signed authorization request and posts it back.
  const consentPage = new URL(authorize.headers.get('location') ?? '');
  const consent = await app.handle(
    new Request('http://localhost/api/auth/oauth2/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ accept: true, oauth_query: consentPage.search.slice(1) }),
    }),
  );
  const { url } = (await consent.json()) as { url: string };
  const token = await app.handle(
    new Request('http://localhost/api/auth/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: new URL(url).searchParams.get('code') ?? '',
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: CODE_VERIFIER,
      }),
    }),
  );
  return ((await token.json()) as { access_token: string }).access_token;
}

async function mcpInitialize(bearer: string) {
  return app.handle(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearer}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
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

// god can deactivate an account without deleting it: its sessions are revoked, it
// cannot sign in or use its API keys, and god sees the status. Reactivating lets it back
// in with the same keys. Not for the instance owner, an agent's account, or while a SCIM
// provider manages accounts.
describe('god deactivate / reactivate', () => {
  beforeEach(resetDb);

  it('revokes the session, blocks sign-in, and reports the status', async () => {
    const { god } = await setup();
    const victim = await signUpTestUser({ team: false });
    const asVictim = authedApi(victim.cookie);

    // The account works before.
    expect((await asVictim.projects.get()).status).toBe(200);

    const deactivated = await god.api.god.users({ userId: victim.userId }).deactivate.post();
    expect(deactivated.status).toBe(200);
    expect(deactivated.data?.active).toBe(false);

    // The existing session is gone, and a fresh sign-in is refused.
    expect((await asVictim.projects.get()).status).toBe(401);
    expect((await signIn(victim.email)).status).toBe(403);

    // god sees it as inactive in the directory.
    const listed = await god.api.god.users({ userId: victim.userId }).get();
    expect(listed.data?.active).toBe(false);
  });

  it('lets the account sign in again after reactivation', async () => {
    const { god } = await setup();
    const victim = await signUpTestUser({ team: false });

    await god.api.god.users({ userId: victim.userId }).deactivate.post();
    const reactivated = await god.api.god.users({ userId: victim.userId }).reactivate.post();
    expect(reactivated.data?.active).toBe(true);

    expect((await signIn(victim.email)).status).toBe(200);
  });

  it('revokes the MCP OAuth tokens the account approved', async () => {
    const { god } = await setup();
    const victim = await signUpTestUser({ team: false });
    const accessToken = await mcpAccessToken(victim.cookie);
    expect((await mcpInitialize(accessToken)).status).toBe(200);

    await god.api.god.users({ userId: victim.userId }).deactivate.post();
    expect((await mcpInitialize(accessToken)).status).toBe(401);

    // Deleted, not merely refused: reactivating does not bring the token back.
    await god.api.god.users({ userId: victim.userId }).reactivate.post();
    expect((await mcpInitialize(accessToken)).status).toBe(401);
  });

  it('reports the status and the lock of each account in the list', async () => {
    const { god } = await setup();
    const victim = await signUpTestUser({ team: false });
    await god.api.god.users({ userId: victim.userId }).deactivate.post();

    const listed = await god.api.god.users.get({ query: { kind: 'all', page: 1, pageSize: 50 } });

    expect(listed.status).toBe(200);
    expect(listed.data!.items).toContainEqual(
      expect.objectContaining({ id: god.id, active: true, activeLock: 'owner' }),
    );
    expect(listed.data!.items).toContainEqual(
      expect.objectContaining({ id: victim.userId, active: false, activeLock: null }),
    );
  });

  it('answers 404 for an account that does not exist', async () => {
    const { god } = await setup();
    const missing = god.api.god.users({ userId: 'no-such-user' });

    expect((await missing.deactivate.post()).status).toBe(404);
    expect((await missing.reactivate.post()).status).toBe(404);
  });

  it('refuses to deactivate the instance owner', async () => {
    const { god } = await setup();
    expect((await god.api.god.users({ userId: god.id }).deactivate.post()).status).toBe(403);
    expect((await god.api.god.users({ userId: god.id }).reactivate.post()).status).toBe(403);
    expect((await god.api.god.users({ userId: god.id }).get()).data?.activeLock).toBe('owner');
  });

  it('keeps the API keys, refused while deactivated and working again once reactivated', async () => {
    const { god } = await setup();
    const victim = await signUpTestUser({ team: false });
    const created = await auth.api.createApiKey({ body: { userId: victim.userId, name: 'ci' } });

    await god.api.god.users({ userId: victim.userId }).deactivate.post();
    expect((await apiKeyApi(created.key).projects.get()).status).toBe(401);

    await god.api.god.users({ userId: victim.userId }).reactivate.post();
    expect((await apiKeyApi(created.key).projects.get()).status).toBe(200);
  });

  it("refuses to switch an agent's account", async () => {
    const { god } = await setup();
    await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
    const botId = await createAgentUser(god, 'MKT');

    expect((await god.api.god.users({ userId: botId }).deactivate.post()).status).toBe(403);
    expect((await god.api.god.users({ userId: botId }).reactivate.post()).status).toBe(403);
    expect((await god.api.god.users({ userId: botId }).get()).data?.activeLock).toBe('agent');
  });

  it('leaves accounts to the SCIM provider while it manages them', async () => {
    const { god } = await setupScim();
    const person = await signUpTestUser({ team: false });
    const account = god.api.god.users({ userId: person.userId });

    expect((await account.get()).data?.activeLock).toBe('scim');
    expect((await account.deactivate.post()).status).toBe(409);
    expect((await account.reactivate.post()).status).toBe(409);
    expect((await account.get()).data?.active).toBe(true);
  });

  it('drops the pending invites the deactivated account created', async () => {
    const { god } = await setup();
    await god.api.projects.post({ key: 'MKT', name: 'Marketing' });
    const inviter = await signUpTestUser({ team: false });
    const invite = await god.api.projects({ projectKey: 'MKT' }).invites.post({
      email: inviter.email,
      role: 'owner',
    });
    await authedApi(inviter.cookie).invites({ token: invite.data!.token }).accept.post();
    await authedApi(inviter.cookie)
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: 'guest@example.test', role: 'member' });
    const before = await god.api.projects({ projectKey: 'MKT' }).invites.get();
    expect(before.data!.filter((i) => i.email === 'guest@example.test')).toHaveLength(1);

    await god.api.god.users({ userId: inviter.userId }).deactivate.post();

    const pending = await god.api.projects({ projectKey: 'MKT' }).invites.get();
    expect(pending.status).toBe(200);
    expect(pending.data!.filter((i) => i.email === 'guest@example.test')).toHaveLength(0);
  });
});
