import { describe, it, expect, beforeEach } from 'bun:test';
import { api, authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser, type TestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';
import { PERMISSION_RESOURCES, PERMISSION_ACTIONS } from '../../../shared/permissions';

// Integration coverage for the roles feature: the static permission catalog,
// listing a project's roles (any member), and creating, updating, and deleting a
// role (owner only). Roles are the per-project permission matrices assigned to
// members; every project starts with one default "Member" role. Role management
// is owner-only and deliberately not delegated through the permission matrix.
// Real sessions against the real (test) database. See apps/api/AGENTS.md "Tests".

type Actor = { user: TestUser; api: ReturnType<typeof authedApi> };

// Creates a project MKT owned by a fresh user and returns a Treaty client acting
// as that owner. The first user in a reset DB is "god"; the owner still reaches
// the project only through its project_member row, so this is a plain owner.
async function setupOwner(): Promise<Actor> {
  const user = await signUpTestUser();
  const api = authedApi(user.cookie);
  await api.projects.post({ key: 'MKT', name: 'Marketing' });
  return { user, api };
}

// Adds a fresh user to MKT on the default role by inviting them and accepting on
// their behalf. Returns that user and a Treaty client acting as them.
async function addMember(owner: Actor): Promise<Actor> {
  const user = await signUpTestUser();
  const created = await owner.api
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member' });
  const api = authedApi(user.cookie);
  await api.invites({ token: created.data!.token }).accept.post();
  return { user, api };
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
      expect(res.data?.resources).toEqual([...PERMISSION_RESOURCES]);
      expect(res.data?.actions).toEqual([...PERMISSION_ACTIONS]);
    });
  });

  describe('list — GET /projects/:projectKey/roles', () => {
    it('returns the default Member role on a fresh project', async () => {
      const owner = await setupOwner();

      const res = await owner.api.projects({ projectKey: 'MKT' }).roles.get();

      expect(res.status).toBe(200);
      expect(res.data).toHaveLength(1);
      expect(res.data?.[0]).toMatchObject({ name: 'Member', isDefault: true });
      // The default role carries a normalized matrix: full work_items, no member
      // management.
      expect(res.data?.[0].permissions.work_items.create).toBe(true);
      expect(res.data?.[0].permissions.members_manage.read).toBe(false);
    });

    it('lists roles ordered by id, default first', async () => {
      const owner = await setupOwner();
      await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Editor', permissions: {} });
      await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Viewer', permissions: {} });

      const res = await owner.api.projects({ projectKey: 'MKT' }).roles.get();

      expect(res.status).toBe(200);
      expect(res.data?.map((r) => r.name)).toEqual(['Member', 'Editor', 'Viewer']);
    });

    it('is readable by a plain member', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await member.api.projects({ projectKey: 'MKT' }).roles.get();

      expect(res.status).toBe(200);
      expect(res.data?.map((r) => r.name)).toEqual(['Member']);
    });

    it('denies a non-member with 403', async () => {
      await setupOwner();
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider.projects({ projectKey: 'MKT' }).roles.get();
      expect(res.status).toBe(403);
    });

    it('denies an anonymous request with 401', async () => {
      await setupOwner();

      const res = await api.projects({ projectKey: 'MKT' }).roles.get();
      expect(res.status).toBe(401);
    });
  });

  describe('create — POST /projects/:projectKey/roles', () => {
    it('creates a non-default role, sanitizing the permission matrix', async () => {
      const owner = await setupOwner();

      const res = await owner.api.projects({ projectKey: 'MKT' }).roles.post({
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

    it('returns 409 for a duplicate role name in the same project', async () => {
      const owner = await setupOwner();
      await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Editor', permissions: {} });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Editor', permissions: {} });
      expect(res.status).toBe(409);
    });

    it('allows the same role name in a different project', async () => {
      const owner = await setupOwner();
      await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Editor', permissions: {} });
      await owner.api.projects.post({ key: 'OPS', name: 'Operations' });

      const res = await owner.api
        .projects({ projectKey: 'OPS' })
        .roles.post({ name: 'Editor', permissions: {} });
      expect(res.status).toBe(201);
    });

    it('returns 400 for an empty name', async () => {
      const owner = await setupOwner();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: '', permissions: {} });
      expect(res.status).toBe(400);
    });

    it('denies a plain member with 403', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await member.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Editor', permissions: {} });
      expect(res.status).toBe(403);
    });

    it('denies a non-member with 403', async () => {
      await setupOwner();
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Editor', permissions: {} });
      expect(res.status).toBe(403);
    });
  });

  describe('update — PATCH /projects/:projectKey/roles/:roleId', () => {
    // Creates a custom role on MKT and returns its id.
    async function createRole(owner: Actor, name = 'Editor'): Promise<number> {
      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name, permissions: {} });
      return res.data!.id;
    }

    it('renames a role', async () => {
      const owner = await setupOwner();
      const roleId = await createRole(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles({ roleId })
        .patch({ name: 'Reviewer' });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: roleId, name: 'Reviewer' });
    });

    it('replaces the permission matrix, sanitizing input', async () => {
      const owner = await setupOwner();
      const roleId = await createRole(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles({ roleId })
        .patch({ permissions: { members_manage: { read: true, edit: 'no' } } });

      expect(res.status).toBe(200);
      expect(res.data?.permissions.members_manage.read).toBe(true);
      expect(res.data?.permissions.members_manage.edit).toBe(false);
    });

    it('leaves the role unchanged for an empty body', async () => {
      const owner = await setupOwner();
      const roleId = await createRole(owner, 'Editor');

      const res = await owner.api.projects({ projectKey: 'MKT' }).roles({ roleId }).patch({});

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: roleId, name: 'Editor' });
    });

    it('can rename the default role', async () => {
      const owner = await setupOwner();
      const list = await owner.api.projects({ projectKey: 'MKT' }).roles.get();
      const defaultId = list.data!.find((r) => r.isDefault)!.id;

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles({ roleId: defaultId })
        .patch({ name: 'Contributor' });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ name: 'Contributor', isDefault: true });
    });

    it('returns 404 for a role that does not exist', async () => {
      const owner = await setupOwner();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles({ roleId: 999999 })
        .patch({ name: 'Nope' });
      expect(res.status).toBe(404);
    });

    it('returns 404 for a role belonging to another project', async () => {
      const owner = await setupOwner();
      await owner.api.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = await owner.api
        .projects({ projectKey: 'OPS' })
        .roles.post({ name: 'Ops', permissions: {} });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles({ roleId: foreign.data!.id })
        .patch({ name: 'Hijack' });
      expect(res.status).toBe(404);
    });

    it('returns 409 when renaming to an existing role name', async () => {
      const owner = await setupOwner();
      await createRole(owner, 'Editor');
      const viewerId = await createRole(owner, 'Viewer');

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles({ roleId: viewerId })
        .patch({ name: 'Editor' });
      expect(res.status).toBe(409);
    });

    it('returns 400 for an empty name', async () => {
      const owner = await setupOwner();
      const roleId = await createRole(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles({ roleId })
        .patch({ name: '' });
      expect(res.status).toBe(400);
    });

    it('denies a plain member with 403', async () => {
      const owner = await setupOwner();
      const roleId = await createRole(owner);
      const member = await addMember(owner);

      const res = await member.api
        .projects({ projectKey: 'MKT' })
        .roles({ roleId })
        .patch({ name: 'Reviewer' });
      expect(res.status).toBe(403);
    });
  });

  describe('delete — DELETE /projects/:projectKey/roles/:roleId', () => {
    // Creates a custom role on MKT and returns its id.
    async function createRole(owner: Actor, name = 'Editor'): Promise<number> {
      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name, permissions: {} });
      return res.data!.id;
    }

    it('deletes a custom role', async () => {
      const owner = await setupOwner();
      const roleId = await createRole(owner);

      const res = await owner.api.projects({ projectKey: 'MKT' }).roles({ roleId }).delete();
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).roles.get();
      expect(list.data?.map((r) => r.id)).not.toContain(roleId);
    });

    it('reassigns members on the deleted role to the default role', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const roleId = await createRole(owner);
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId });

      const res = await owner.api.projects({ projectKey: 'MKT' }).roles({ roleId }).delete();
      expect(res.status).toBe(204);

      // The member falls back to the default "Member" role rather than a dangling
      // reference.
      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.find((m) => m.userId === member.user.userId);
      expect(row).toMatchObject({ roleName: 'Member' });
      expect(row?.roleId).not.toBe(roleId);
    });

    it('returns 400 when deleting the default role', async () => {
      const owner = await setupOwner();
      const list = await owner.api.projects({ projectKey: 'MKT' }).roles.get();
      const defaultId = list.data!.find((r) => r.isDefault)!.id;

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles({ roleId: defaultId })
        .delete();
      expect(res.status).toBe(400);

      // The default role is still there.
      const after = await owner.api.projects({ projectKey: 'MKT' }).roles.get();
      expect(after.data?.map((r) => r.id)).toContain(defaultId);
    });

    it('returns 404 for a role that does not exist', async () => {
      const owner = await setupOwner();

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles({ roleId: 999999 })
        .delete();
      expect(res.status).toBe(404);
    });

    it('returns 404 for a role belonging to another project', async () => {
      const owner = await setupOwner();
      await owner.api.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = await owner.api
        .projects({ projectKey: 'OPS' })
        .roles.post({ name: 'Ops', permissions: {} });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles({ roleId: foreign.data!.id })
        .delete();
      expect(res.status).toBe(404);
    });

    it('denies a plain member with 403', async () => {
      const owner = await setupOwner();
      const roleId = await createRole(owner);
      const member = await addMember(owner);

      const res = await member.api.projects({ projectKey: 'MKT' }).roles({ roleId }).delete();
      expect(res.status).toBe(403);
    });

    it('denies a non-member with 403', async () => {
      const owner = await setupOwner();
      const roleId = await createRole(owner);
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider.projects({ projectKey: 'MKT' }).roles({ roleId }).delete();
      expect(res.status).toBe(403);
    });
  });
});
