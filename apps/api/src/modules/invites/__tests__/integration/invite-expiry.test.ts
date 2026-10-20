import { beforeEach, describe, expect, it } from 'bun:test';
import { auth, setAuthSettings } from '@repo/auth';
import { db, teamInvite } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { createRole } from '#tests/helpers/roles';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Invites expire (default 7 days). An expired invite neither gates registration nor
// can be accepted, and a pending invite is deleted when its creator is removed.
async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  return { asOwner, teamId: project.data!.teamId };
}

const project = (api: Api) => api.projects({ projectKey: 'MKT' });

// A mail provider is set, but nothing listens on its port: every send fails.
async function failingProvider(api: Api) {
  const closed = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } });
  const port = closed.port;
  closed.stop(true);
  const configured = await api.god['email-settings'].put({
    from: 'Test <noreply@example.com>',
    smtp: {
      enabled: true,
      host: '127.0.0.1',
      port,
      encryption: 'none',
      username: '',
      timeout: 2,
    },
    allowProjects: false,
  });
  expect(configured.status).toBe(200);
}

async function backdate(token: string, days: number) {
  await db
    .update(teamInvite)
    .set({ createdAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) })
    .where(eq(teamInvite.token, token));
}

describe('invite expiry and cleanup', () => {
  beforeEach(resetDb);

  it('refuses to accept an invite older than the TTL', async () => {
    const { asOwner } = await setup();
    const invitee = await signUpTestUser({ team: false });
    const asInvitee = authedApi(invitee.cookie);
    const invite = await project(asOwner).invites.post({ email: invitee.email, role: 'member' });
    const token = invite.data!.token;

    await backdate(token, 8);
    expect((await asInvitee.invites({ token }).accept.post()).status).toBe(409);
  });

  it('accepts an invite one day inside the TTL', async () => {
    const { asOwner } = await setup();
    const invitee = await signUpTestUser({ team: false });
    const asInvitee = authedApi(invitee.cookie);
    const invite = await project(asOwner).invites.post({ email: invitee.email, role: 'member' });
    const token = invite.data!.token;

    await backdate(token, 6);
    expect((await asInvitee.invites({ token }).accept.post()).status).toBe(200);
  });

  it('accepts an old invite when the TTL is 0', async () => {
    const { asOwner } = await setup();
    await setAuthSettings({ inviteTtlDays: 0 });
    const invitee = await signUpTestUser({ team: false });
    const asInvitee = authedApi(invitee.cookie);
    const invite = await project(asOwner).invites.post({ email: invitee.email, role: 'member' });
    const token = invite.data!.token;

    await backdate(token, 400);
    expect((await asInvitee.invites({ token }).accept.post()).status).toBe(200);
  });

  it('lets an invited address register on an invite-only instance only while the invite is valid', async () => {
    const { asOwner } = await setup();
    await setAuthSettings({ registration: 'invite' });
    const signUp = (email: string) =>
      auth.api.signUpEmail({
        body: { email, password: 'test-password-123', name: 'Guest' },
        asResponse: true,
      });

    const expired = await project(asOwner).invites.post({
      email: 'late@example.com',
      role: 'member',
    });
    await backdate(expired.data!.token, 8);
    await expect(signUp('late@example.com')).rejects.toThrow('This instance is invite-only');

    await project(asOwner).invites.post({ email: 'early@example.com', role: 'member' });
    expect((await signUp('early@example.com')).status).toBe(200);
  });

  it('still accepts a fresh invite', async () => {
    const { asOwner } = await setup();
    const invitee = await signUpTestUser({ team: false });
    const asInvitee = authedApi(invitee.cookie);
    const invite = await project(asOwner).invites.post({ email: invitee.email, role: 'member' });

    expect((await asInvitee.invites({ token: invite.data!.token }).accept.post()).status).toBe(200);
  });

  it('deletes a pending invite when its creator is removed from the team', async () => {
    const { asOwner, teamId } = await setup();
    const roleId = (
      await createRole(asOwner, 'MKT', {
        name: 'Inviter',
        permissions: { members_invite: { read: true, create: true } },
      })
    ).data!.id;

    // A member who can invite joins through an invite of their own.
    const member = await signUpTestUser({ team: false });
    const asMember = authedApi(member.cookie);
    const memberInvite = await project(asOwner).invites.post({
      email: member.email,
      role: 'member',
      roleId,
    });
    await asMember.invites({ token: memberInvite.data!.token }).accept.post();

    // They invite someone, then the owner removes them from the team.
    const guest = await signUpTestUser({ team: false });
    const asGuest = authedApi(guest.cookie);
    const guestInvite = await project(asMember).invites.post({
      email: guest.email,
      role: 'member',
    });
    const guestToken = guestInvite.data!.token;

    await asOwner.teams({ teamId }).members({ userId: member.userId }).delete();

    // The guest's invite is gone.
    expect((await asGuest.invites({ token: guestToken }).accept.post()).status).toBe(404);
  });
});

// An expired invite is never revived: inviting again or renewing hands out a new link
// with a fresh validity, and the old link stops existing.
describe('renewing an expired invite', () => {
  beforeEach(resetDb);

  it('lets the same address be invited again once the old invite expired', async () => {
    const { asOwner } = await setup();
    const first = await project(asOwner).invites.post({
      email: 'again@example.com',
      role: 'member',
    });
    expect(
      (await project(asOwner).invites.post({ email: 'again@example.com', role: 'member' })).status,
    ).toBe(409);

    await backdate(first.data!.token, 8);
    const second = await project(asOwner).invites.post({
      email: 'again@example.com',
      role: 'member',
    });
    expect(second.status).toBe(201);
    expect(second.data!.token).not.toBe(first.data!.token);
    expect((await asOwner.invites({ token: first.data!.token }).get()).status).toBe(404);
  });

  it('shows when a pending invite expires, and that an old one has', async () => {
    const { asOwner } = await setup();
    const invite = await project(asOwner).invites.post({
      email: 'show@example.com',
      role: 'member',
    });
    const listed = (await project(asOwner).invites.get()).data!;
    expect(new Date(listed[0].expiresAt!).getTime()).toBeGreaterThan(Date.now());

    await backdate(invite.data!.token, 8);
    expect((await asOwner.invites({ token: invite.data!.token }).get()).data!.expired).toBe(true);
  });

  it('queues the email of a renewed project invite, as creating one does', async () => {
    const { asOwner } = await setup();
    const configured = await asOwner.god['email-settings'].put({
      from: "It's a Plan <noreply@example.com>",
      resend: { enabled: true, apiKey: 're_test_key' },
      allowProjects: false,
    });
    expect(configured.status).toBe(200);
    const old = await project(asOwner).invites.post({
      email: 'lapsed@example.com',
      role: 'member',
    });
    await backdate(old.data!.token, 8);

    const renewed = await project(asOwner).invites({ inviteId: old.data!.id }).renew.post();
    expect(renewed.status).toBe(201);
    expect(renewed.data!.emailQueued).toBe(true);
  });

  it('renews an expired project invite under a new link for the same role', async () => {
    const { asOwner } = await setup();
    const invitee = await signUpTestUser({ team: false });
    const old = await project(asOwner).invites.post({ email: invitee.email, role: 'owner' });
    await backdate(old.data!.token, 8);

    const renewed = await project(asOwner).invites({ inviteId: old.data!.id }).renew.post();
    expect(renewed.status).toBe(201);
    expect(renewed.data!.token).not.toBe(old.data!.token);
    expect(renewed.data!.role).toBe('owner');

    const asInvitee = authedApi(invitee.cookie);
    expect((await asInvitee.invites({ token: old.data!.token }).accept.post()).status).toBe(404);
    expect((await asInvitee.invites({ token: renewed.data!.token }).accept.post()).status).toBe(
      200,
    );
  });

  it('does not renew an invite that is still valid, nor mail an expired one', async () => {
    const { asOwner } = await setup();
    const invite = await project(asOwner).invites.post({
      email: 'live@example.com',
      role: 'member',
    });
    const id = invite.data!.id;
    expect((await project(asOwner).invites({ inviteId: id }).renew.post()).status).toBe(409);

    await backdate(invite.data!.token, 8);
    expect((await project(asOwner).invites({ inviteId: id }).email.post()).status).toBe(409);
  });

  it('renews an expired team invite from the team', async () => {
    const { asOwner, teamId } = await setup();
    const old = await asOwner
      .teams({ teamId })
      .invites.post({ email: 'crew@example.com', role: 'member' });
    await backdate(old.data!.token, 8);

    const renewed = await asOwner
      .teams({ teamId })
      .invites({ inviteId: old.data!.id })
      .renew.post();
    expect(renewed.status).toBe(201);
    // No provider here: nothing was sent, and nothing failed.
    expect(renewed.data).toMatchObject({ emailQueued: false, emailFailed: false });
    expect(renewed.data!.token).not.toBe(old.data!.token);
    const pending = (await asOwner.teams({ teamId }).invites.get()).data!.filter(
      (i) => i.status === 'pending',
    );
    expect(pending.map((i) => i.token)).toEqual([renewed.data!.token]);
  });

  it('holds a renewal to the rank rules of creating the invite', async () => {
    const { asOwner, teamId } = await setup();
    const old = await asOwner
      .teams({ teamId })
      .invites.post({ email: 'boss@example.com', role: 'manager' });
    await backdate(old.data!.token, 8);

    const manager = await signUpTestUser({ team: false });
    const managerInvite = await asOwner.teams({ teamId }).invites.post({
      email: manager.email,
      role: 'manager',
    });
    const asManager = authedApi(manager.cookie);
    await asManager.invites({ token: managerInvite.data!.token }).accept.post();

    const renew = asManager.teams({ teamId }).invites({ inviteId: old.data!.id }).renew;
    expect((await renew.post()).status).toBe(403);
  });

  it("holds a project renewal to who may hand out the project's ownership", async () => {
    const { asOwner } = await setup();
    const roleId = (
      await createRole(asOwner, 'MKT', {
        name: 'Inviter',
        permissions: { members_invite: { read: true, create: true } },
      })
    ).data!.id;
    const member = await signUpTestUser({ team: false });
    const asMember = authedApi(member.cookie);
    const memberInvite = await project(asOwner).invites.post({
      email: member.email,
      role: 'member',
      roleId,
    });
    await asMember.invites({ token: memberInvite.data!.token }).accept.post();

    const ownership = await project(asOwner).invites.post({
      email: 'heir@example.com',
      role: 'owner',
    });
    const plain = await project(asOwner).invites.post({
      email: 'plain@example.com',
      role: 'member',
    });
    await backdate(ownership.data!.token, 8);
    await backdate(plain.data!.token, 8);

    const renew = (id: number) => project(asMember).invites({ inviteId: id }).renew.post();
    expect((await renew(ownership.data!.id)).status).toBe(403);
    expect((await renew(plain.data!.id)).status).toBe(201);
  });

  it('does not renew from a project or a team the invite does not belong to', async () => {
    const { asOwner, teamId } = await setup();
    await createProject(asOwner, { key: 'OPS', name: 'Operations' });
    const elsewhere = await asOwner
      .projects({ projectKey: 'OPS' })
      .invites.post({ email: 'ops@example.com', role: 'member' });
    await backdate(elsewhere.data!.token, 8);
    const renewFromMkt = project(asOwner).invites({ inviteId: elsewhere.data!.id }).renew;
    expect((await renewFromMkt.post()).status).toBe(404);

    const other = await signUpTestUser({ name: 'Other' });
    const asOther = authedApi(other.cookie);
    const otherTeam = (await createProject(asOther, { key: 'OTH', name: 'Other' })).data!.teamId;
    const foreign = await asOther
      .teams({ teamId: otherTeam })
      .invites.post({ email: 'foreign@example.com', role: 'member' });
    await backdate(foreign.data!.token, 8);
    const renewFromTeam = asOwner.teams({ teamId }).invites({ inviteId: foreign.data!.id }).renew;
    expect((await renewFromTeam.post()).status).toBe(404);
  });

  it('does not renew a team invite that is still valid', async () => {
    const { asOwner, teamId } = await setup();
    const live = await asOwner
      .teams({ teamId })
      .invites.post({ email: 'live-team@example.com', role: 'member' });

    const renew = asOwner.teams({ teamId }).invites({ inviteId: live.data!.id }).renew;
    expect((await renew.post()).status).toBe(409);
  });

  it('renews an expired project invite from the team list', async () => {
    const { asOwner, teamId } = await setup();
    const old = await project(asOwner).invites.post({ email: 'proj@example.com', role: 'member' });
    await backdate(old.data!.token, 8);

    const renewed = await asOwner
      .teams({ teamId })
      .invites({ inviteId: old.data!.id })
      .renew.post();
    expect(renewed.status).toBe(201);
    expect(renewed.data!.projectKey).toBe('MKT');
    expect(renewed.data!.token).not.toBe(old.data!.token);
  });
});

describe('invite lifetime setting', () => {
  beforeEach(resetDb);

  it('refuses a lifetime past what a date can hold', async () => {
    const owner = await signUpTestUser({ name: 'God' });
    const asGod = authedApi(owner.cookie);
    expect((await asGod.god['auth-settings'].put({ inviteTtlDays: 3651 })).status).toBe(400);
    expect((await asGod.god['auth-settings'].put({ inviteTtlDays: 30 })).status).toBe(200);
  });
});

// A team invite that is still valid can be mailed again, the same link; an expired one
// is renewed instead.
describe('mailing a team invite again', () => {
  beforeEach(resetDb);

  it('mails a valid team invite and a project invite of the team', async () => {
    const { asOwner, teamId } = await setup();
    const team = await asOwner
      .teams({ teamId })
      .invites.post({ email: 'mail@example.com', role: 'member' });
    const proj = await project(asOwner).invites.post({
      email: 'mailp@example.com',
      role: 'member',
    });

    for (const id of [team.data!.id, proj.data!.id]) {
      const sent = await asOwner.teams({ teamId }).invites({ inviteId: id }).email.post();
      expect(sent.status).toBe(200);
      // The test instance has no mail provider, so nothing goes out and the caller is told.
      expect(sent.data).toEqual({ emailQueued: false });
    }
  });

  it('refuses to mail an expired team invite', async () => {
    const { asOwner, teamId } = await setup();
    const team = await asOwner
      .teams({ teamId })
      .invites.post({ email: 'late@example.com', role: 'member' });
    await backdate(team.data!.token, 8);

    const sent = await asOwner.teams({ teamId }).invites({ inviteId: team.data!.id }).email.post();
    expect(sent.status).toBe(409);
  });

  it('does not mail an invite of another team', async () => {
    const { asOwner, teamId } = await setup();
    const other = await signUpTestUser({ name: 'Other owner' });
    const asOther = authedApi(other.cookie);
    const otherTeamId = (await createProject(asOther, { key: 'OPS', name: 'Ops' })).data!.teamId;
    const foreign = await asOther
      .teams({ teamId: otherTeamId })
      .invites.post({ email: 'foreign@example.com', role: 'member' });

    const sent = await asOwner
      .teams({ teamId })
      .invites({ inviteId: foreign.data!.id })
      .email.post();
    expect(sent.status).toBe(404);
  });

  it('leaves mailing team invites to whoever runs the team', async () => {
    const { asOwner, teamId } = await setup();
    const member = await signUpTestUser({ team: false });
    const join = await asOwner
      .teams({ teamId })
      .invites.post({ email: member.email, role: 'member' });
    const asMember = authedApi(member.cookie);
    await asMember.invites({ token: join.data!.token }).accept.post();
    const other = await asOwner
      .teams({ teamId })
      .invites.post({ email: 'x@example.com', role: 'member' });

    const sent = await asMember
      .teams({ teamId })
      .invites({ inviteId: other.data!.id })
      .email.post();
    expect(sent.status).toBe(403);
  });

  it('reports a failed send as an error, not as a missing provider', async () => {
    const { asOwner, teamId } = await setup();
    await failingProvider(asOwner);
    const team = await asOwner
      .teams({ teamId })
      .invites.post({ email: 'fail@example.com', role: 'member' });

    const sent = await asOwner.teams({ teamId }).invites({ inviteId: team.data!.id }).email.post();
    expect(sent.status).toBe(502);
  });
});

// A failed email is told apart from a missing provider when an invite is created or
// renewed: the invite stands, and the person is not sent looking for a configuration.
describe('reporting an invite email that could not be sent', () => {
  beforeEach(resetDb);

  it('creates a team invite and reports its failed email', async () => {
    const { asOwner, teamId } = await setup();
    await failingProvider(asOwner);

    const created = await asOwner
      .teams({ teamId })
      .invites.post({ email: 'f@example.com', role: 'member' });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ emailQueued: false, emailFailed: true });
  });

  it('renews an expired team invite and reports its failed email', async () => {
    const { asOwner, teamId } = await setup();
    const old = await asOwner
      .teams({ teamId })
      .invites.post({ email: 'r@example.com', role: 'member' });
    await backdate(old.data!.token, 8);
    await failingProvider(asOwner);

    const renewed = await asOwner
      .teams({ teamId })
      .invites({ inviteId: old.data!.id })
      .renew.post();
    expect(renewed.status).toBe(201);
    expect(renewed.data).toMatchObject({ emailQueued: false, emailFailed: true });
  });

  it('reports no failure where there is no provider at all', async () => {
    const { asOwner, teamId } = await setup();
    const created = await asOwner
      .teams({ teamId })
      .invites.post({ email: 'n@example.com', role: 'member' });
    expect(created.data).toMatchObject({ emailQueued: false, emailFailed: false });
  });
});
