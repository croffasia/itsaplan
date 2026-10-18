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
      from: 'One Health <noreply@example.com>',
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
    expect(renewed.data!.token).not.toBe(old.data!.token);
    // A team invite has no email of its own: its new link is returned to share.
    expect(renewed.data!.emailQueued).toBe(false);
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
