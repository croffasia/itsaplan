import { beforeEach, describe, expect, it } from 'bun:test';
import { auth, setAuthSettings } from '@repo/auth';
import { createHmac } from 'node:crypto';
import { db, teamInvite } from '@repo/db';
import { eq } from 'drizzle-orm';
import { api, authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

async function setup(verified = true) {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  const project = (await createProject(asOwner, { key: 'MKT', name: 'Marketing' })).data!;
  const invitee = await signUpTestUser({ team: false });
  if (verified) {
    const now = Math.floor(Date.now() / 1000);
    const input = [{ alg: 'HS256' }, { email: invitee.email, iat: now, exp: now + 60 }]
      .map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'))
      .join('.');
    const signature = createHmac('sha256', (await auth.$context).secret)
      .update(input)
      .digest('base64url');
    const token = `${input}.${signature}`;
    await auth.api.verifyEmail({ query: { token } });
  }
  const client = authedApi(invitee.cookie);
  const invite = (
    await asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: invitee.email, role: 'member' })
  ).data!;
  return { client, asOwner, invitee, invite, project };
}

describe('received invitations', () => {
  beforeEach(resetDb);

  it('requires a signed-in account with a verified email', async () => {
    const { client, invite } = await setup(false);
    expect((await api.me.invites.get()).status).toBe(401);
    const result = await client.me.invites.get();
    expect(result.status).toBe(403);
    expect(JSON.stringify(result.error)).not.toContain(invite.token);
  });

  it('discovers only the current email invitations without granting membership', async () => {
    const { client, asOwner, invite, project } = await setup();
    await asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: 'another@example.com', role: 'member' });
    const result = await client.me.invites.get();
    expect(result.status).toBe(200);
    expect(result.data?.items).toEqual([
      { token: invite.token, teamName: expect.any(String), projectName: 'Marketing' },
    ]);
    expect(result.data?.total).toBe(1);
    expect(result.response.headers.get('cache-control')).toBe('private, no-store');
    expect((await client.teams.get()).data?.some((team) => team.id === project.teamId)).toBe(false);
    expect((await client.invites({ token: invite.token }).accept.post()).status).toBe(200);
    expect((await client.me.invites.get()).data?.total).toBe(0);
  });

  it('pages team and project invitations with a stable total', async () => {
    const { client, asOwner, invitee, project } = await setup();
    const teamInvite = await asOwner
      .teams({ teamId: project.teamId })
      .invites.post({ email: invitee.email, role: 'member' });
    expect(teamInvite.status).toBe(201);
    const first = await client.me.invites.get({ query: { page: 1, pageSize: 1 } });
    const second = await client.me.invites.get({ query: { page: 2, pageSize: 1 } });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.data?.total).toBe(2);
    expect(first.data?.items).toHaveLength(1);
    expect(second.data?.items).toHaveLength(1);
    expect(first.data?.items[0]?.token).not.toBe(second.data?.items[0]?.token);
    expect(first.data?.items[0]?.projectName).toBe(null);
  });

  it('excludes expired invitations and honors unlimited lifetime', async () => {
    const { client, invite } = await setup();
    await db
      .update(teamInvite)
      .set({ createdAt: new Date(Date.now() - 8 * 86400000) })
      .where(eq(teamInvite.token, invite.token));
    expect((await client.me.invites.get()).data?.total).toBe(0);
    expect((await client.invites({ token: invite.token }).accept.post()).status).toBe(409);
    await setAuthSettings({ inviteTtlDays: 0 });
    expect((await client.me.invites.get()).data?.total).toBe(1);
  });

  it('removes declined invitations', async () => {
    const { client, invite } = await setup();
    expect((await client.invites({ token: invite.token }).reject.post()).status).toBe(204);
    expect((await client.me.invites.get()).data?.total).toBe(0);
  });

  it('removes revoked invitations', async () => {
    const { client, asOwner, invite } = await setup();
    expect((await client.me.invites.get()).data?.total).toBe(1);
    expect(
      (await asOwner.projects({ projectKey: 'MKT' }).invites({ inviteId: invite.id }).delete())
        .status,
    ).toBe(204);
    expect((await client.me.invites.get()).data?.total).toBe(0);
  });

  it('rejects invalid paging windows', async () => {
    const { client } = await setup();
    expect((await client.me.invites.get({ query: { page: 0 } })).status).toBe(400);
    expect((await client.me.invites.get({ query: { pageSize: 101 } })).status).toBe(400);
  });
});
