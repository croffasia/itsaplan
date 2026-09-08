import { describe, it, expect, beforeEach } from 'bun:test';
import { api, authedApi } from '#tests/helpers/app';
import { signUpTestUser, type TestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS, resourceActions } from '#shared/permissions';
import { createAgent, setAgentProjectRole } from '#tests/helpers/agents';

// Integration coverage for the roles feature: the static permission catalog, the
// two ways to list roles (a team's own list, and the list a project draws on), and
// creating, updating, and deleting a role. Roles are the permission matrices a
// team's projects assign to their members; every team starts with one default
// "Member" role. Managing them is team-owner-only and deliberately not delegated
// through the permission matrix. Real sessions against the real (test) database.
// See apps/api/AGENTS.md "Tests".

type Actor = { user: TestUser; api: ReturnType<typeof authedApi>; teamId: number };

// Creates a project MKT owned by a fresh user and returns a Treaty client acting as
// that owner, with the team the account was registered with. The first user in a
// reset DB is "god"; the owner still reaches the project only through its
// project_member row, so this is a plain owner.
async function setupOwner(projectKey = 'MKT'): Promise<Actor> {
  const user = await signUpTestUser();
  const client = authedApi(user.cookie);
  await client.projects.post({ key: projectKey, name: 'Marketing' });
  const teams = await client.teams.get();
  return { user, api: client, teamId: teams.data![0].id };
}

// Adds a fresh user to MKT on the default role by inviting them and accepting on
// their behalf. Joining a project also joins the team that owns it, on the plain
// 'member' team role.
async function addMember(owner: Actor): Promise<Actor> {
  const user = await signUpTestUser();
  const created = await owner.api
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member' });
  const client = authedApi(user.cookie);
  await client.invites({ token: created.data!.token }).accept.post();
  const teams = await client.teams.get();
  return { user, api: client, teamId: teams.data![0].id };
}

// Invites a fresh user into the owner's team as a manager and accepts for them.
async function addManager(owner: Actor): Promise<Actor> {
  const user = await signUpTestUser();
  const created = await owner.api
    .teams({ teamId: owner.teamId })
    .invites.post({ email: user.email, role: 'manager' });
  const client = authedApi(user.cookie);
  await client.invites({ token: created.data!.token }).accept.post();
  return { user, api: client, teamId: owner.teamId };
}

describe('roles', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('permission catalog — GET /permission-catalog', () => {
    it('returns the static resources and actions', async () => {
      const owner = await setupOwner();

      const res = await owner.api['permission-catalog'].get();

      expect(res.status).toBe(200);
      expect(res.data?.resources).toEqual(
        PERMISSION_RESOURCES.map((key) => ({ key, actions: [...resourceActions(key)] })),
      );
      expect(res.data?.actions).toEqual([...PERMISSION_ACTIONS]);
    });

    it('narrows a resource that does not carry the whole action set', async () => {
      const owner = await setupOwner();

      const res = await owner.api['permission-catalog'].get();

      const dangerZone = res.data?.resources.find((r) => r.key === 'danger_zone');
      expect(dangerZone?.actions).toEqual(['read', 'delete']);
    });
  });

  describe('list — GET /teams/:teamId/roles', () => {
    it('returns the default Member role on a fresh team', async () => {
      const owner = await setupOwner();

      const res = await owner.api.teams({ teamId: owner.teamId }).roles.get();

      expect(res.status).toBe(200);
      expect(res.data?.items).toHaveLength(1);
      expect(res.data?.items[0]).toMatchObject({ name: 'Member', isDefault: true });
      // The default role carries a normalized matrix: full work_items, the member
      // list readable, no member management.
      expect(res.data?.items[0].permissions.work_items.create).toBe(true);
      expect(res.data?.items[0].permissions.members_manage.read).toBe(true);
      expect(res.data?.items[0].permissions.members_manage.create).toBe(false);
    });

    it('lists roles ordered by id, default first', async () => {
      const owner = await setupOwner();
      await owner.api.teams({ teamId: owner.teamId }).roles.post({
        name: 'Editor',
        permissions: {},
      });
      await owner.api.teams({ teamId: owner.teamId }).roles.post({
        name: 'Viewer',
        permissions: {},
      });

      const res = await owner.api.teams({ teamId: owner.teamId }).roles.get();

      expect(res.status).toBe(200);
      expect(res.data?.items.map((r) => r.name)).toEqual(['Member', 'Editor', 'Viewer']);
    });

    it('pages the list, counting every role of the team', async () => {
      const owner = await setupOwner();
      await owner.api
        .teams({ teamId: owner.teamId })
        .roles.post({ name: 'Editor', permissions: {} });

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles.get({ query: { page: 2, pageSize: 1 } });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ total: 2, page: 2, pageSize: 1 });
      expect(res.data?.items.map((r) => r.name)).toEqual(['Editor']);
    });

    it('searches the roles by name', async () => {
      const owner = await setupOwner();
      await owner.api
        .teams({ teamId: owner.teamId })
        .roles.post({ name: 'Editor', permissions: {} });

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles.get({ query: { search: 'edit' } });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ total: 1 });
      expect(res.data?.items.map((r) => r.name)).toEqual(['Editor']);
    });

    it('is readable by a plain member of the team', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await member.api.teams({ teamId: owner.teamId }).roles.get();

      expect(res.status).toBe(200);
      expect(res.data?.items.map((r) => r.name)).toEqual(['Member']);
    });

    it('denies someone outside the team with 404', async () => {
      const owner = await setupOwner();
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider.teams({ teamId: owner.teamId }).roles.get();
      expect(res.status).toBe(404);
    });

    it('denies an anonymous request with 401', async () => {
      const owner = await setupOwner();

      const res = await api.teams({ teamId: owner.teamId }).roles.get();
      expect(res.status).toBe(401);
    });
  });

  describe('options — GET /teams/:teamId/roles/options', () => {
    it('answers with every role of the team, matrices included', async () => {
      const owner = await setupOwner();
      await owner.api
        .teams({ teamId: owner.teamId })
        .roles.post({ name: 'Editor', permissions: { work_items: { edit: true } } });

      const res = await owner.api.teams({ teamId: owner.teamId }).roles.options.get();

      expect(res.status).toBe(200);
      expect(res.data?.map((r) => r.name)).toEqual(['Member', 'Editor']);
      expect(res.data?.[1].permissions.work_items.edit).toBe(true);
    });

    it('denies someone outside the team with 404', async () => {
      const owner = await setupOwner();
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider.teams({ teamId: owner.teamId }).roles.options.get();
      expect(res.status).toBe(404);
    });
  });

  describe('create — POST /teams/:teamId/roles', () => {
    it('creates a non-default role, sanitizing the permission matrix', async () => {
      const owner = await setupOwner();

      const res = await owner.api.teams({ teamId: owner.teamId }).roles.post({
        name: 'Editor',
        // Unknown keys are dropped; non-true values coerce to false; missing
        // entries default to false.
        permissions: {
          work_items: { read: true, create: 'yes', destroy: true },
          not_a_resource: { read: true },
        },
      });

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ name: 'Editor', isDefault: false });
      expect(res.data?.permissions.work_items.read).toBe(true);
      expect(res.data?.permissions.work_items.create).toBe(false);
      expect(res.data?.permissions.members_manage.read).toBe(false);
      expect((res.data?.permissions as Record<string, unknown>).not_a_resource).toBeUndefined();
    });

    it('returns 409 for a duplicate role name in the same team', async () => {
      const owner = await setupOwner();
      await owner.api.teams({ teamId: owner.teamId }).roles.post({
        name: 'Editor',
        permissions: {},
      });

      const res = await owner.api.teams({ teamId: owner.teamId }).roles.post({
        name: 'Editor',
        permissions: {},
      });
      expect(res.status).toBe(409);
    });

    it('allows the same role name in a different team', async () => {
      const owner = await setupOwner();
      await owner.api.teams({ teamId: owner.teamId }).roles.post({
        name: 'Editor',
        permissions: {},
      });
      const other = await setupOwner('OPS');

      const res = await other.api.teams({ teamId: other.teamId }).roles.post({
        name: 'Editor',
        permissions: {},
      });
      expect(res.status).toBe(201);
    });

    it('returns 400 for an empty name', async () => {
      const owner = await setupOwner();

      const res = await owner.api.teams({ teamId: owner.teamId }).roles.post({
        name: '',
        permissions: {},
      });
      expect(res.status).toBe(400);
    });

    it('denies a member who neither owns nor manages the team with 403', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await member.api.teams({ teamId: owner.teamId }).roles.post({
        name: 'Editor',
        permissions: {},
      });
      expect(res.status).toBe(403);
    });

    it('allows a manager of the team', async () => {
      const owner = await setupOwner();
      const manager = await addManager(owner);

      const res = await manager.api.teams({ teamId: owner.teamId }).roles.post({
        name: 'Editor',
        permissions: {},
      });
      expect(res.status).toBe(201);
    });
  });

  describe('update — PATCH /teams/:teamId/roles/:roleId', () => {
    // Creates a custom role on the owner's team and returns its id.
    async function makeRole(owner: Actor, name = 'Editor'): Promise<number> {
      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles.post({ name, permissions: {} });
      return res.data!.id;
    }

    it('renames a role', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId })
        .patch({ name: 'Reviewer' });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: roleId, name: 'Reviewer' });
    });

    it('replaces the permission matrix, sanitizing input', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId })
        .patch({ permissions: { members_manage: { read: true, edit: 'no' } } });

      expect(res.status).toBe(200);
      expect(res.data?.permissions.members_manage.read).toBe(true);
      expect(res.data?.permissions.members_manage.edit).toBe(false);
    });

    it('leaves the role unchanged for an empty body', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner, 'Editor');

      const res = await owner.api.teams({ teamId: owner.teamId }).roles({ roleId }).patch({});

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: roleId, name: 'Editor' });
    });

    it('can rename the default role', async () => {
      const owner = await setupOwner();
      const list = await owner.api.teams({ teamId: owner.teamId }).roles.get();
      const defaultId = list.data!.items.find((r) => r.isDefault)!.id;

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId: defaultId })
        .patch({ name: 'Contributor' });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ name: 'Contributor', isDefault: true });
    });

    it('returns 404 for a role that does not exist', async () => {
      const owner = await setupOwner();

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId: 999999 })
        .patch({ name: 'Nope' });
      expect(res.status).toBe(404);
    });

    it('returns 404 for a role belonging to another team', async () => {
      const owner = await setupOwner();
      const other = await setupOwner('OPS');
      const foreign = await makeRole(other, 'Ops');

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId: foreign })
        .patch({ name: 'Hijack' });
      expect(res.status).toBe(404);
    });

    it('returns 409 when renaming to an existing role name', async () => {
      const owner = await setupOwner();
      await makeRole(owner, 'Editor');
      const viewerId = await makeRole(owner, 'Viewer');

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId: viewerId })
        .patch({ name: 'Editor' });
      expect(res.status).toBe(409);
    });

    it('returns 400 for an empty name', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId })
        .patch({ name: '' });
      expect(res.status).toBe(400);
    });

    it('denies a member who neither owns nor manages the team with 403', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);
      const member = await addMember(owner);

      const res = await member.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId })
        .patch({ name: 'Reviewer' });
      expect(res.status).toBe(403);
    });

    it('allows a manager of the team', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);
      const manager = await addManager(owner);

      const res = await manager.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId })
        .patch({ name: 'Reviewer' });
      expect(res.status).toBe(200);
    });
  });

  describe('usage — GET /teams/:teamId/roles/:roleId/usage', () => {
    it('counts the members on a role', async () => {
      const owner = await setupOwner();
      const created = await owner.api
        .teams({ teamId: owner.teamId })
        .roles.post({ name: 'Editor', permissions: {} });
      const roleId = created.data!.id;

      const empty = await owner.api.teams({ teamId: owner.teamId }).roles({ roleId }).usage.get();
      expect(empty.status).toBe(200);
      expect(empty.data).toMatchObject({ members: 0, agents: 0, invites: 0 });

      const member = await addMember(owner);
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId });

      const res = await owner.api.teams({ teamId: owner.teamId }).roles({ roleId }).usage.get();
      expect(res.data).toMatchObject({ members: 1, agents: 0, invites: 0 });
    });

    it('counts an agent on the role once, as an agent', async () => {
      const owner = await setupOwner();
      const created = await owner.api
        .teams({ teamId: owner.teamId })
        .roles.post({ name: 'Editor', permissions: {} });
      const roleId = created.data!.id;

      // The agent's bot user holds a project_member row on the role, which must be
      // counted as an agent rather than as a member of its own.
      const agent = await createAgent(owner.api, 'MKT', {
        name: 'Ext',
        username: 'ext',
        kind: 'external',
      });
      await setAgentProjectRole(owner.api, 'MKT', agent.data!.agent.userId, roleId);

      const res = await owner.api.teams({ teamId: owner.teamId }).roles({ roleId }).usage.get();
      expect(res.data).toMatchObject({ members: 0, agents: 1, invites: 0 });
    });

    it('returns 404 for a role that does not exist', async () => {
      const owner = await setupOwner();

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId: 999999 })
        .usage.get();
      expect(res.status).toBe(404);
    });
  });

  describe('delete — DELETE /teams/:teamId/roles/:roleId', () => {
    // Creates a custom role on the owner's team and returns its id.
    async function makeRole(owner: Actor, name = 'Editor'): Promise<number> {
      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles.post({ name, permissions: {} });
      return res.data!.id;
    }

    it('deletes a custom role', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);

      const res = await owner.api.teams({ teamId: owner.teamId }).roles({ roleId }).delete();
      expect(res.status).toBe(204);

      const list = await owner.api.teams({ teamId: owner.teamId }).roles.get();
      expect(list.data?.items.map((r) => r.id)).not.toContain(roleId);
    });

    // Puts a fresh member of MKT on the role, so it counts as in use.
    async function putMemberOn(owner: Actor, roleId: number): Promise<Actor> {
      const member = await addMember(owner);
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId });
      return member;
    }

    it('returns 400 for a role in use without a target role', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);
      await putMemberOn(owner, roleId);

      const res = await owner.api.teams({ teamId: owner.teamId }).roles({ roleId }).delete();
      expect(res.status).toBe(400);

      const after = await owner.api.teams({ teamId: owner.teamId }).roles.get();
      expect(after.data?.items.map((r) => r.id)).toContain(roleId);
    });

    it('moves the members on the role to the target role and deletes it', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);
      const target = await makeRole(owner, 'Reviewer');
      const member = await putMemberOn(owner, roleId);

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId })
        .delete(undefined, { query: { targetRoleId: target } });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      expect(list.data?.items.find((m) => m.userId === member.user.userId)).toMatchObject({
        roleId: target,
        roleName: 'Reviewer',
      });
    });

    it('returns 400 when the target role is the role being deleted', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);
      await putMemberOn(owner, roleId);

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId })
        .delete(undefined, { query: { targetRoleId: roleId } });
      expect(res.status).toBe(400);
    });

    it("returns 404 when the target role is another team's", async () => {
      const owner = await setupOwner();
      const other = await setupOwner('OPS');
      const roleId = await makeRole(owner);
      const foreign = await makeRole(other, 'Ops');
      await putMemberOn(owner, roleId);

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId })
        .delete(undefined, { query: { targetRoleId: foreign } });
      expect(res.status).toBe(404);
    });

    it('returns 400 when deleting the default role', async () => {
      const owner = await setupOwner();
      const list = await owner.api.teams({ teamId: owner.teamId }).roles.get();
      const defaultId = list.data!.items.find((r) => r.isDefault)!.id;

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId: defaultId })
        .delete();
      expect(res.status).toBe(400);

      // The default role is still there.
      const after = await owner.api.teams({ teamId: owner.teamId }).roles.get();
      expect(after.data?.items.map((r) => r.id)).toContain(defaultId);
    });

    it('returns 404 for a role that does not exist', async () => {
      const owner = await setupOwner();

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId: 999999 })
        .delete();
      expect(res.status).toBe(404);
    });

    it('returns 404 for a role belonging to another team', async () => {
      const owner = await setupOwner();
      const other = await setupOwner('OPS');
      const foreign = await makeRole(other, 'Ops');

      const res = await owner.api
        .teams({ teamId: owner.teamId })
        .roles({ roleId: foreign })
        .delete();
      expect(res.status).toBe(404);
    });

    it('denies a member who does not own the team with 403', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);
      const member = await addMember(owner);

      const res = await member.api.teams({ teamId: owner.teamId }).roles({ roleId }).delete();
      expect(res.status).toBe(403);
    });

    it('denies a manager, who creates and edits roles but does not delete them', async () => {
      const owner = await setupOwner();
      const roleId = await makeRole(owner);
      const manager = await addManager(owner);

      const res = await manager.api.teams({ teamId: owner.teamId }).roles({ roleId }).delete();
      expect(res.status).toBe(403);
    });
  });
});
