import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser, type TestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createRole, listProjectRoles } from '#tests/helpers/roles';

// Integration coverage for the members feature: listing a project's members, adding
// one from the team that owns it, assigning a custom role to a member (owner only),
// and removing a member or leaving the project. Someone outside the team joins
// through an invite, so the tests add a second member by creating and accepting one.
// Real sessions against the real (test) database. See apps/api/AGENTS.md "Tests" for
// setup.

type Actor = { user: TestUser; api: ReturnType<typeof authedApi> };

// Creates a project MKT owned by a fresh user and returns a Treaty client acting
// as that owner. The first user in a reset DB is "god"; the owner still reaches
// the project only through its project_member row, so this is a plain owner.
async function setupOwner(): Promise<Actor> {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  return { user, api };
}

// The owner of a project OPS in a team of their own, for the cases that need a role
// no other team may assign.
async function setupOwner2(): Promise<Actor> {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  await createProject(api, { key: 'OPS', name: 'Operations' });
  return { user, api };
}

// Adds a fresh user to MKT with the given role by inviting them and accepting on
// their behalf. Returns that user and a Treaty client acting as them. A member
// joins on the project's default role; an owner bypasses roles.
async function addMember(owner: Actor, role: 'owner' | 'member' = 'member'): Promise<Actor> {
  const user = await signUpTestUser();
  const created = await owner.api
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role });
  const api = authedApi(user.cookie);
  await api.invites({ token: created.data!.token }).accept.post();
  return { user, api };
}

// Signs up a user and puts them in the team that owns MKT on the given rank, without
// joining the project itself. A manager runs the team's projects from that standing
// alone, which is what the member routes accept in place of a project permission.
async function addTeamMember(
  owner: Actor,
  role: 'manager' | 'member' = 'member',
): Promise<TestUser> {
  const projects = await owner.api.projects.get();
  const teamId = projects.data!.find((p) => p.key === 'MKT')!.teamId;
  const user = await signUpTestUser();
  const invite = await owner.api.teams({ teamId }).invites.post({ email: user.email, role });
  await authedApi(user.cookie).invites({ token: invite.data!.token }).accept.post();
  return user;
}

describe('members', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('add — POST /projects/:projectKey/members', () => {
    it('lists a team member who is not in the project as a candidate', async () => {
      const owner = await setupOwner();
      const joiner = await addTeamMember(owner);

      const res = await owner.api.projects({ projectKey: 'MKT' }).members.candidates.get();
      expect(res.status).toBe(200);
      expect(res.data?.map((c) => c.userId)).toEqual([joiner.userId]);
    });

    it('drops a candidate once they are in the project', async () => {
      const owner = await setupOwner();
      const joiner = await addTeamMember(owner);

      await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: joiner.userId, role: 'member' });

      const res = await owner.api.projects({ projectKey: 'MKT' }).members.candidates.get();
      expect(res.data).toHaveLength(0);
    });

    it('adds them on the given custom role', async () => {
      const owner = await setupOwner();
      const joiner = await addTeamMember(owner);
      const role = await createRole(owner.api, 'MKT', { name: 'Editor', permissions: {} });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: joiner.userId, role: 'member', roleId: role.data!.id });
      expect(res.status).toBe(204);

      const members = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(members.data?.items.find((m) => m.userId === joiner.userId)).toMatchObject({
        role: 'member',
        roleId: role.data!.id,
        roleName: 'Editor',
      });
    });

    it('puts them on the default role when no roleId is given', async () => {
      const owner = await setupOwner();
      const joiner = await addTeamMember(owner);
      const roles = await listProjectRoles(owner.api, 'MKT');
      const fallback = roles.data!.find((r) => r.isDefault)!;

      await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: joiner.userId, role: 'member' });

      const members = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(members.data?.items.find((m) => m.userId === joiner.userId)).toMatchObject({
        roleId: fallback.id,
        roleName: fallback.name,
      });
    });

    it('adds them as an owner, without a role', async () => {
      const owner = await setupOwner();
      const joiner = await addTeamMember(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: joiner.userId, role: 'owner' });
      expect(res.status).toBe(204);

      const members = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(members.data?.items.find((m) => m.userId === joiner.userId)).toMatchObject({
        role: 'owner',
        roleId: null,
      });
    });

    it('denies a member whose role grants members_manage create the owner role with 403', async () => {
      const owner = await setupOwner();
      const joiner = await addTeamMember(owner);
      const adder = await addMember(owner);
      const role = await createRole(owner.api, 'MKT', {
        name: 'People',
        permissions: { members_manage: { read: true, create: true } },
      });
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: adder.user.userId })
        .patch({ role: 'member', roleId: role.data!.id });

      const res = await adder.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: joiner.userId, role: 'owner' });
      expect(res.status).toBe(403);

      expect(
        (
          await adder.api
            .projects({ projectKey: 'MKT' })
            .members.post({ userId: joiner.userId, role: 'member' })
        ).status,
      ).toBe(204);
    });

    it('rejects someone outside the team with 400', async () => {
      const owner = await setupOwner();
      const stranger = await signUpTestUser();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: stranger.userId, role: 'member' });
      expect(res.status).toBe(400);
    });

    it('rejects a roleId from another team with 400', async () => {
      const owner = await setupOwner();
      const joiner = await addTeamMember(owner);
      const other = await setupOwner2();
      const foreign = await createRole(other.api, 'OPS', { name: 'Ops', permissions: {} });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: joiner.userId, role: 'member', roleId: foreign.data!.id });
      expect(res.status).toBe(400);
    });

    it('rejects someone already in the project with 409', async () => {
      const owner = await setupOwner();
      const joiner = await addTeamMember(owner);
      const body = { userId: joiner.userId, role: 'member' as const };

      expect((await owner.api.projects({ projectKey: 'MKT' }).members.post(body)).status).toBe(204);
      expect((await owner.api.projects({ projectKey: 'MKT' }).members.post(body)).status).toBe(409);
    });

    it('denies a member without the permission with 403', async () => {
      const owner = await setupOwner();
      const joiner = await addTeamMember(owner);
      const plain = await addMember(owner);

      const res = await plain.api
        .projects({ projectKey: 'MKT' })
        .members.post({ userId: joiner.userId, role: 'member' });
      expect(res.status).toBe(403);
      expect(
        (await plain.api.projects({ projectKey: 'MKT' }).members.candidates.get()).status,
      ).toBe(403);
    });
  });

  describe('list — GET /projects/:projectKey/members', () => {
    it('lists the owner alone on a fresh project', async () => {
      const owner = await setupOwner();

      const res = await owner.api.projects({ projectKey: 'MKT' }).members.get();

      expect(res.status).toBe(200);
      expect(res.data?.items).toHaveLength(1);
      expect(res.data?.items[0]).toMatchObject({
        userId: owner.user.userId,
        email: owner.user.email,
        username: expect.any(String),
        role: 'owner',
        roleId: null,
        roleName: null,
      });
    });

    it('reflects an added member on the default role, the newest membership first', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await owner.api.projects({ projectKey: 'MKT' }).members.get();

      expect(res.status).toBe(200);
      expect(res.data?.items.map((m) => m.userId)).toEqual([member.user.userId, owner.user.userId]);
      const memberRow = res.data?.items.find((m) => m.userId === member.user.userId);
      expect(memberRow).toMatchObject({ role: 'member', roleName: 'Member' });
      expect(memberRow?.roleId).not.toBeNull();
    });

    it('narrows the list to the people or to the AI agents', async () => {
      const owner = await setupOwner();
      await addMember(owner);
      const members = owner.api.projects({ projectKey: 'MKT' }).members;

      const people = await members.get({ query: { kind: 'human' } });
      expect(people.data?.total).toBe(2);
      expect(people.data?.items.every((m) => !m.isAgent)).toBe(true);

      const agents = await members.get({ query: { kind: 'agent' } });
      expect(agents.data).toMatchObject({ items: [], total: 0 });
    });

    it('searches by name, address and handle', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const members = owner.api.projects({ projectKey: 'MKT' }).members;

      const found = await members.get({ query: { search: member.user.email } });
      expect(found.data?.items.map((m) => m.userId)).toEqual([member.user.userId]);
      expect(found.data?.total).toBe(1);

      const none = await members.get({ query: { search: 'nobody-by-that-name' } });
      expect(none.data).toMatchObject({ items: [], total: 0 });
    });

    it('windows the list and reports how many there are in total', async () => {
      const owner = await setupOwner();
      await addMember(owner);
      await addMember(owner);
      const members = owner.api.projects({ projectKey: 'MKT' }).members;

      const first = await members.get({ query: { page: 1, pageSize: 2 } });
      expect(first.data?.items).toHaveLength(2);
      expect(first.data).toMatchObject({ total: 3, ownerCount: 1 });

      const second = await members.get({ query: { page: 2, pageSize: 2 } });
      expect(second.data?.items).toHaveLength(1);
      expect(second.data?.total).toBe(3);
    });

    it('lets a plain member read the list on the default role', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await member.api.projects({ projectKey: 'MKT' }).members.get();
      expect(res.status).toBe(200);
    });

    it('denies a member whose role lacks members_manage read with 403', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const role = await createRole(owner.api, 'MKT', { name: 'Reader', permissions: {} });
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId: role.data!.id });

      const res = await member.api.projects({ projectKey: 'MKT' }).members.get();
      expect(res.status).toBe(403);
    });

    it('lets a manager of the team read the list without being in the project', async () => {
      const owner = await setupOwner();
      const manager = await addTeamMember(owner, 'manager');

      const res = await authedApi(manager.cookie).projects({ projectKey: 'MKT' }).members.get();
      expect(res.status).toBe(200);
      expect(res.data?.items).toHaveLength(1);
    });

    it('denies a non-member with 403', async () => {
      await setupOwner();
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider.projects({ projectKey: 'MKT' }).members.get();
      expect(res.status).toBe(403);
    });
  });

  describe('assign role — PATCH /projects/:projectKey/members/:userId', () => {
    // Creates a custom role on MKT's team and returns its id.
    async function makeRole(owner: Actor, name = 'Editor'): Promise<number> {
      const res = await createRole(owner.api, 'MKT', { name, permissions: {} });
      return res.data!.id;
    }

    it('assigns a custom role to a member', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const roleId = await makeRole(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.items.find((m) => m.userId === member.user.userId);
      expect(row).toMatchObject({ roleId, roleName: 'Editor' });
    });

    it('puts a member back on the default role with roleId null', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const roleId = await makeRole(owner);
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId: null });
      expect(res.status).toBe(204);

      const roles = await listProjectRoles(owner.api, 'MKT');
      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.items.find((m) => m.userId === member.user.userId);
      expect(row?.roleId).toBe(roles.data!.find((r) => r.isDefault)!.id);
    });

    it('assigns a system role the instance owner made', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const system = await owner.api.god.roles.post({ name: 'Viewer', permissions: {} });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId: system.data!.id });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.items.find((m) => m.userId === member.user.userId);
      expect(row).toMatchObject({ roleId: system.data!.id, roleName: 'Viewer' });
    });

    it('returns 404 for a userId that is not a member', async () => {
      const owner = await setupOwner();
      const stranger = await signUpTestUser();
      const roleId = await makeRole(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: stranger.userId })
        .patch({ role: 'member', roleId });
      expect(res.status).toBe(404);
    });

    it('promotes a member to owner', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'owner' });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.items.find((m) => m.userId === member.user.userId);
      expect(row).toMatchObject({ role: 'owner', roleId: null, roleName: null });
    });

    it('demotes an owner to a member role when another owner remains', async () => {
      const owner = await setupOwner();
      const other = await addMember(owner, 'owner');
      const roleId = await makeRole(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: other.user.userId })
        .patch({ role: 'member', roleId });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.items.find((m) => m.userId === other.user.userId);
      expect(row).toMatchObject({ role: 'member', roleId, roleName: 'Editor' });
    });

    it('refuses to change your own role with 400', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: owner.user.userId })
        .patch({ role: 'member', roleId });
      expect(res.status).toBe(400);

      // The owner is unchanged.
      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.items.find((m) => m.userId === owner.user.userId);
      expect(row).toMatchObject({ role: 'owner' });
    });

    it('returns 400 when the role belongs to another team', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      // Every project of a team shares its roles, so only a role of another team is
      // out of reach here.
      const stranger = await setupOwner2();
      const foreign = await createRole(stranger.api, 'OPS', { name: 'Ops', permissions: {} });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId: foreign.data!.id });
      expect(res.status).toBe(400);
    });

    it('returns 400 when role is missing from the body', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        // @ts-expect-error — role is required
        .patch({ roleId: null });
      expect(res.status).toBe(400);
    });

    it('denies a non-owner member with 403', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const other = await addMember(owner);
      const roleId = await makeRole(owner);

      const res = await member.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: other.user.userId })
        .patch({ role: 'member', roleId });
      expect(res.status).toBe(403);
    });

    it('lets a manager of the team assign a role without being in the project', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const manager = await addTeamMember(owner, 'manager');
      const roleId = await makeRole(owner);

      const res = await authedApi(manager.cookie)
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(list.data?.items.find((m) => m.userId === member.user.userId)).toMatchObject({
        roleId,
      });
    });

    it('lets a member whose role grants members_manage edit assign a role', async () => {
      const owner = await setupOwner();
      const editor = await addMember(owner);
      const other = await addMember(owner);
      const role = await createRole(owner.api, 'MKT', {
        name: 'People',
        permissions: { members_manage: { read: true, edit: true } },
      });
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: editor.user.userId })
        .patch({ role: 'member', roleId: role.data!.id });

      const res = await editor.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: other.user.userId })
        .patch({ role: 'member', roleId: role.data!.id });
      expect(res.status).toBe(204);
    });

    it('denies a member whose role grants members_manage edit the owner role with 403', async () => {
      const owner = await setupOwner();
      const editor = await addMember(owner);
      const other = await addMember(owner);
      const role = await createRole(owner.api, 'MKT', {
        name: 'People',
        permissions: { members_manage: { read: true, edit: true } },
      });
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: editor.user.userId })
        .patch({ role: 'member', roleId: role.data!.id });

      const res = await editor.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: other.user.userId })
        .patch({ role: 'owner' });
      expect(res.status).toBe(403);
    });

    it('lets a manager of the team promote a member to owner', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const manager = await addTeamMember(owner, 'manager');

      const res = await authedApi(manager.cookie)
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'owner' });
      expect(res.status).toBe(204);
    });

    it('denies a non-member with 403', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId: null });
      expect(res.status).toBe(403);
    });
  });

  describe('description — PATCH /projects/:projectKey/members/:userId/description', () => {
    it("defaults a member's description to empty", async () => {
      const owner = await setupOwner();

      const res = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(res.data?.items[0]).toMatchObject({ description: '' });
    });

    it("lets an owner set a member's description", async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .description.patch({ description: 'Backend engineer' });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.items.find((m) => m.userId === member.user.userId);
      expect(row).toMatchObject({ description: 'Backend engineer' });
    });

    it('clears a description with an empty string', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .description.patch({ description: 'QA' });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .description.patch({ description: '' });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.items.find((m) => m.userId === member.user.userId);
      expect(row).toMatchObject({ description: '' });
    });

    it('404s for a non-member userId', async () => {
      const owner = await setupOwner();
      const stranger = await signUpTestUser();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: stranger.userId })
        .description.patch({ description: 'x' });
      expect(res.status).toBe(404);
    });

    it('lets a member set their own description', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await member.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .description.patch({ description: 'I do the docs' });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.items.find((m) => m.userId === member.user.userId);
      expect(row).toMatchObject({ description: 'I do the docs' });
    });

    it("lets a manager of the team set a member's description without being in the project", async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const manager = await addTeamMember(owner, 'manager');

      const res = await authedApi(manager.cookie)
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .description.patch({ description: 'Runs the launch' });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(list.data?.items.find((m) => m.userId === member.user.userId)).toMatchObject({
        description: 'Runs the launch',
      });
    });

    it("denies a member editing another member's description with 403", async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const other = await addMember(owner);

      const res = await member.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: other.user.userId })
        .description.patch({ description: 'not yours' });
      expect(res.status).toBe(403);
    });
  });

  describe('remove — DELETE /projects/:projectKey/members/:userId', () => {
    it('lets an owner remove a member, revoking their access', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .delete();
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(list.data?.items.map((m) => m.userId)).toEqual([owner.user.userId]);

      // The removed member can no longer reach the project.
      const gone = await member.api.projects({ projectKey: 'MKT' }).get();
      expect(gone.status).toBe(403);
    });

    it('lets a member remove themselves (leave the project)', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await member.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .delete();
      expect(res.status).toBe(204);

      const gone = await member.api.projects({ projectKey: 'MKT' }).get();
      expect(gone.status).toBe(403);
    });

    it('denies a member removing another member with 403', async () => {
      const owner = await setupOwner();
      const a = await addMember(owner);
      const b = await addMember(owner);

      const res = await a.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: b.user.userId })
        .delete();
      expect(res.status).toBe(403);

      // b is still a member.
      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(list.data?.items.map((m) => m.userId)).toContain(b.user.userId);
    });

    it('returns 404 when the userId is not a member', async () => {
      const owner = await setupOwner();
      const stranger = await signUpTestUser();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: stranger.userId })
        .delete();
      expect(res.status).toBe(404);
    });

    it('refuses to remove the last owner with 400', async () => {
      const owner = await setupOwner();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: owner.user.userId })
        .delete();
      expect(res.status).toBe(400);

      // The owner is still a member.
      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(list.data?.items.map((m) => m.userId)).toContain(owner.user.userId);
    });

    it('lets an owner leave when another owner remains', async () => {
      const owner = await setupOwner();
      await addMember(owner, 'owner');

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: owner.user.userId })
        .delete();
      expect(res.status).toBe(204);
    });

    it('lets a manager of the team remove a member without being in the project', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const manager = await addTeamMember(owner, 'manager');

      const res = await authedApi(manager.cookie)
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .delete();
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(list.data?.items.map((m) => m.userId)).toEqual([owner.user.userId]);
    });

    it('denies a non-member with 403', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .delete();
      expect(res.status).toBe(403);
    });
  });
});
