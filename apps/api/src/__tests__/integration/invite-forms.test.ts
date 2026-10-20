import { beforeEach, describe, expect, it } from 'bun:test';
import { auth, setAuthSettings } from '@repo/auth';
import { db, teamInvite } from '@repo/db';
import { eq } from 'drizzle-orm';
import { app, authedApi, apiKeyApi, createProject } from '#tests/helpers/app';
import { openMagicLink, signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { mcpAccessToken } from '#tests/helpers/mcp';

// The invite lifecycle and the registration gate hold on every way into the instance,
// not only on the provider round trip: the email form (with and without a username),
// the magic link, an instance without personal workspaces, an API key on the REST
// routes, and the MCP tools with an API key or an OAuth token.
// invite-expiry.test.ts covers the session routes.

const DAY = 24 * 60 * 60 * 1000;

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  return { owner, asOwner, teamId: project.data!.teamId };
}

async function invite(asOwner: ReturnType<typeof authedApi>, email: string, ageDays = 0) {
  const created = await asOwner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email, role: 'member' });
  if (ageDays > 0) {
    await db
      .update(teamInvite)
      .set({ createdAt: new Date(Date.now() - ageDays * DAY) })
      .where(eq(teamInvite.token, created.data!.token));
  }
  return created.data!;
}

const signUp = (email: string, extra: Record<string, string> = {}) =>
  auth.api.signUpEmail({
    body: { email, password: 'test-password-123', name: 'Newcomer', ...extra },
    asResponse: true,
  });

async function refusalCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    return (err as { body?: { code?: string } }).body?.code ?? 'unknown';
  }
}

describe('the email form and the registration gate', () => {
  beforeEach(resetDb);

  it('creates the account on an open instance', async () => {
    await setup();
    await setAuthSettings({ registration: 'open' });
    expect((await signUp('open@example.com')).status).toBe(200);
  });

  it('refuses it on a closed instance with REGISTRATION_CLOSED', async () => {
    await setup();
    await setAuthSettings({ registration: 'closed' });
    expect(await refusalCode(signUp('closed@example.com'))).toBe('REGISTRATION_CLOSED');
  });

  it('refuses an address with no invite on an invite-only instance with INVITE_ONLY', async () => {
    await setup();
    await setAuthSettings({ registration: 'invite' });
    expect(await refusalCode(signUp('nobody@example.com'))).toBe('INVITE_ONLY');
  });

  it('applies the same gate to a sign-up that carries a username', async () => {
    await setup();
    await setAuthSettings({ registration: 'invite' });
    expect(await refusalCode(signUp('named@example.com', { username: 'named-newcomer' }))).toBe(
      'INVITE_ONLY',
    );
  });

  // The email form is open to anyone, so it must not reveal that an address was invited.
  it('refuses an address whose invite expired as plainly invite-only', async () => {
    const { asOwner } = await setup();
    await setAuthSettings({ registration: 'invite' });
    await invite(asOwner, 'lapsed@example.com', 8);
    expect(await refusalCode(signUp('lapsed@example.com'))).toBe('INVITE_ONLY');
  });

  it('refuses a username sign-up whose invite expired as plainly invite-only', async () => {
    const { asOwner } = await setup();
    await setAuthSettings({ registration: 'invite' });
    await invite(asOwner, 'lapsed@example.com', 8);
    expect(await refusalCode(signUp('lapsed@example.com', { username: 'lapsed-newcomer' }))).toBe(
      'INVITE_ONLY',
    );
  });

  it('lets an invited address in on an instance without personal workspaces', async () => {
    const { asOwner } = await setup();
    await setAuthSettings({ registration: 'invite', personalWorkspaces: false });
    await invite(asOwner, 'invited@example.com');
    expect((await signUp('invited@example.com')).status).toBe(200);
  });
});

describe('the magic link and the registration gate', () => {
  beforeEach(resetDb);

  // A magic link proves the address, so it may be told that its invite expired.
  it('refuses an address whose invite expired with INVITE_EXPIRED', async () => {
    const { asOwner } = await setup();
    await setAuthSettings({ registration: 'invite' });
    await invite(asOwner, 'lapsed@example.com', 8);
    const location = await openMagicLink('lapsed@example.com', 'magic-lapsed');
    expect(location.searchParams.get('error')).toBe('INVITE_EXPIRED');
  });

  it('creates the account of an invited address and signs it in', async () => {
    const { asOwner } = await setup();
    await setAuthSettings({ registration: 'invite' });
    await invite(asOwner, 'linked@example.com');
    const location = await openMagicLink('linked@example.com', 'magic-invited');
    expect(location.searchParams.get('error')).toBeNull();
  });
});

describe('invites over an API key', () => {
  beforeEach(resetDb);

  it('creates, lists and renews a project invite through the REST routes', async () => {
    const { owner, asOwner } = await setup();
    const { key } = await auth.api.createApiKey({ body: { userId: owner.userId, name: 'ci' } });
    const asKey = apiKeyApi(key).projects({ projectKey: 'MKT' });

    const created = await asKey.invites.post({ email: 'key@example.com', role: 'member' });
    expect(created.status).toBe(201);
    expect(created.data!.emailFailed).toBe(false);
    await db
      .update(teamInvite)
      .set({ createdAt: new Date(Date.now() - 8 * DAY) })
      .where(eq(teamInvite.token, created.data!.token));

    const listed = (await asKey.invites.get()).data!;
    expect(new Date(listed[0].expiresAt!).getTime()).toBeLessThan(Date.now());

    const renewed = await asKey.invites({ inviteId: created.data!.id }).renew.post();
    expect(renewed.status).toBe(201);
    expect(renewed.data!.token).not.toBe(created.data!.token);
    // The session client sees the same single pending invite.
    const pending = (await asOwner.projects({ projectKey: 'MKT' }).invites.get()).data!;
    expect(pending.filter((i) => i.status === 'pending')).toHaveLength(1);
  });
});

describe('invites over MCP', () => {
  beforeEach(resetDb);

  async function rpc(bearer: string, method: string, params: Record<string, unknown> = {}) {
    const res = await app.handle(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${bearer}`,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      }),
    );
    const text = await res.text();
    return JSON.parse(text.slice(text.indexOf('data: ') + 6)).result;
  }

  async function call(bearer: string, name: string, args: Record<string, unknown>) {
    const result = await rpc(bearer, 'tools/call', { name, arguments: args });
    return { text: result.content[0].text as string, isError: result.isError === true };
  }

  it('renews an expired invite and refuses to mail it before that', async () => {
    const { owner, asOwner } = await setup();
    const { key } = await auth.api.createApiKey({ body: { userId: owner.userId, name: 'mcp' } });
    const old = await invite(asOwner, 'mcp@example.com', 8);

    const mailed = await call(key, 'send_invite_email', { projectKey: 'MKT', inviteId: old.id });
    expect(mailed.isError).toBe(true);

    const renewed = await call(key, 'renew_invite', { projectKey: 'MKT', inviteId: old.id });
    expect(renewed.isError).toBe(false);
    const body = JSON.parse(renewed.text) as { token: string; expiresAt: string };
    expect(body.token).not.toBe(old.token);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  // An OAuth client takes the other branch of /mcp, where the token is forwarded to the
  // REST route instead of an x-api-key header.
  it('applies the same rules to a client connected over OAuth', async () => {
    const { owner, asOwner } = await setup();
    const accessToken = await mcpAccessToken(owner.cookie);
    const old = await invite(asOwner, 'oauth@example.com', 8);

    const mailed = await call(accessToken, 'send_invite_email', {
      projectKey: 'MKT',
      inviteId: old.id,
    });
    expect(mailed.isError).toBe(true);

    const renewed = await call(accessToken, 'renew_invite', {
      projectKey: 'MKT',
      inviteId: old.id,
    });
    expect(renewed.isError).toBe(false);
    expect((JSON.parse(renewed.text) as { token: string }).token).not.toBe(old.token);
  });
});
