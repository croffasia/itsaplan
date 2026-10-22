import { beforeEach, describe, expect, it } from 'bun:test';
import { db, teamInvite } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, createProject } from '#tests/helpers/app';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Two escalation paths the member permission must not open: a non-owner must not be
// able to unseat an owner, and assigning a role must not grant permissions beyond the
// granter's own.
async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const created = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  expect(created.status).toBe(201);
  return { asOwner };
}

// A handler: can manage members and invite, but holds no ai_agents permission.
function handlerPermissions() {
  return {
    members_manage: { read: true, create: true, edit: true, delete: true },
    members_invite: { read: true, create: true },
  };
}

const project = (api: ReturnType<typeof authedApi>) => api.projects({ projectKey: 'MKT' });

describe('role escalation guards', () => {
  beforeEach(resetDb);

  it('lets only an owner demote or expel another owner', async () => {
    const { asOwner } = await setup();
    const roleId = (
      await createRole(asOwner, 'MKT', { name: 'Handler', permissions: handlerPermissions() })
    ).data!.id;
    const asHandler = await addProjectMember(asOwner, 'MKT', roleId);

    // A second person joins, then the real owner promotes them to owner.
    const victim = await signUpTestUser({ team: false });
    const asVictim = authedApi(victim.cookie);
    const invite = await project(asOwner).invites.post({ email: victim.email, role: 'member' });
    await asVictim.invites({ token: invite.data!.token }).accept.post();
    await project(asOwner).members({ userId: victim.userId }).patch({ role: 'owner' });

    // The handler cannot demote or expel the owner.
    expect(
      (await project(asHandler).members({ userId: victim.userId }).patch({ role: 'member' }))
        .status,
    ).toBe(403);
    expect((await project(asHandler).members({ userId: victim.userId }).delete()).status).toBe(403);

    // The owner can.
    expect((await project(asOwner).members({ userId: victim.userId }).delete()).status).toBe(204);
  });

  it('refuses to invite with a role more powerful than the granter', async () => {
    const { asOwner } = await setup();
    const handler = (
      await createRole(asOwner, 'MKT', { name: 'Handler', permissions: handlerPermissions() })
    ).data!.id;
    const powerful = (
      await createRole(asOwner, 'MKT', {
        name: 'Powerful',
        permissions: { ...handlerPermissions(), ai_agents: { read: true, edit: true } },
      })
    ).data!.id;
    const asHandler = await addProjectMember(asOwner, 'MKT', handler);

    // The handler lacks ai_agents, so it cannot hand out a role that has it.
    expect(
      (
        await project(asHandler).invites.post({
          email: 'new-1@example.com',
          role: 'member',
          roleId: powerful,
        })
      ).status,
    ).toBe(403);

    // A role within its own permissions is fine.
    expect(
      (
        await project(asHandler).invites.post({
          email: 'new-2@example.com',
          role: 'member',
          roleId: handler,
        })
      ).status,
    ).toBe(201);
  });

  it('hides the link of an invite whose role is more powerful than the viewer', async () => {
    const { asOwner } = await setup();
    const handler = (
      await createRole(asOwner, 'MKT', { name: 'Handler', permissions: handlerPermissions() })
    ).data!.id;
    const powerful = (
      await createRole(asOwner, 'MKT', {
        name: 'Powerful',
        permissions: { ...handlerPermissions(), ai_agents: { read: true, edit: true } },
      })
    ).data!.id;
    const asHandler = await addProjectMember(asOwner, 'MKT', handler);
    await project(asOwner).invites.post({
      email: 'strong@example.com',
      role: 'member',
      roleId: powerful,
    });
    await project(asOwner).invites.post({
      email: 'peer@example.com',
      role: 'member',
      roleId: handler,
    });

    const tokens = async (api: ReturnType<typeof authedApi>) =>
      Object.fromEntries(
        ((await project(api).invites.get()).data ?? []).map((i) => [i.email, i.token]),
      );
    const asSeenByHandler = await tokens(asHandler);
    expect(asSeenByHandler['strong@example.com']).toBeNull();
    expect(asSeenByHandler['peer@example.com']).toBeString();
    expect((await tokens(asOwner))['strong@example.com']).toBeString();
  });

  it('refuses to renew an invite with a role more powerful than the renewer', async () => {
    const { asOwner } = await setup();
    const handler = (
      await createRole(asOwner, 'MKT', { name: 'Handler', permissions: handlerPermissions() })
    ).data!.id;
    const powerful = (
      await createRole(asOwner, 'MKT', {
        name: 'Powerful',
        permissions: { ...handlerPermissions(), ai_agents: { read: true, edit: true } },
      })
    ).data!.id;
    const asHandler = await addProjectMember(asOwner, 'MKT', handler);

    const invite = await project(asOwner).invites.post({
      email: 'new-1@example.com',
      role: 'member',
      roleId: powerful,
    });
    await db
      .update(teamInvite)
      .set({ createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
      .where(eq(teamInvite.token, invite.data!.token));

    expect(
      (await project(asHandler).invites({ inviteId: invite.data!.id }).renew.post()).status,
    ).toBe(403);
    expect(
      (await project(asOwner).invites({ inviteId: invite.data!.id }).renew.post()).status,
    ).toBe(201);
  });

  it('refuses to add or move a member to a role more powerful than the granter', async () => {
    const { asOwner } = await setup();
    const handler = (
      await createRole(asOwner, 'MKT', { name: 'Handler', permissions: handlerPermissions() })
    ).data!.id;
    const powerful = (
      await createRole(asOwner, 'MKT', {
        name: 'Powerful',
        permissions: { ...handlerPermissions(), ai_agents: { read: true, edit: true } },
      })
    ).data!.id;
    const asHandler = await addProjectMember(asOwner, 'MKT', handler);

    // Someone in the team but not in the project yet.
    const projects = await asOwner.projects.get();
    const teamId = projects.data!.find((p) => p.key === 'MKT')!.teamId;
    const newcomer = await signUpTestUser({ team: false });
    const teamInvite = await asOwner
      .teams({ teamId })
      .invites.post({ email: newcomer.email, role: 'member' });
    await authedApi(newcomer.cookie).invites({ token: teamInvite.data!.token }).accept.post();

    expect(
      (
        await project(asHandler).members.post({
          userId: newcomer.userId,
          role: 'member',
          roleId: powerful,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await project(asHandler).members.post({
          userId: newcomer.userId,
          role: 'member',
          roleId: handler,
        })
      ).status,
    ).toBe(204);

    expect(
      (
        await project(asHandler)
          .members({ userId: newcomer.userId })
          .patch({ role: 'member', roleId: powerful })
      ).status,
    ).toBe(403);
  });
});
