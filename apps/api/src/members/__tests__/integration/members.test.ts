import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser, type TestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// Integration coverage for the members feature: listing a project's members,
// assigning a custom role to a member (owner only), and removing a member or
// leaving the project. New members join through invites, so the tests add a
// second member by creating and accepting an invite. Real sessions against the
// real (test) database. See apps/api/AGENTS.md "Tests" for setup.

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

describe('members', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('list — GET /projects/:projectKey/members', () => {
    it('lists the owner alone on a fresh project', async () => {
      const owner = await setupOwner();

      const res = await owner.api.projects({ projectKey: 'MKT' }).members.get();

      expect(res.status).toBe(200);
      expect(res.data).toHaveLength(1);
      expect(res.data?.[0]).toMatchObject({
        userId: owner.user.userId,
        email: owner.user.email,
        role: 'owner',
        roleId: null,
        roleName: null,
      });
    });

    it('reflects an added member on the default role, ordered by join time', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await owner.api.projects({ projectKey: 'MKT' }).members.get();

      expect(res.status).toBe(200);
      expect(res.data?.map((m) => m.userId)).toEqual([owner.user.userId, member.user.userId]);
      const memberRow = res.data?.find((m) => m.userId === member.user.userId);
      expect(memberRow).toMatchObject({ role: 'member', roleName: 'Member' });
      expect(memberRow?.roleId).not.toBeNull();
    });

    it('denies a plain member (default role lacks members_manage read) with 403', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);

      const res = await member.api.projects({ projectKey: 'MKT' }).members.get();
      expect(res.status).toBe(403);
    });

    it('denies a non-member with 403', async () => {
      await setupOwner();
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider.projects({ projectKey: 'MKT' }).members.get();
      expect(res.status).toBe(403);
    });
  });

  describe('assign role — PATCH /projects/:projectKey/members/:userId', () => {
    // Creates a custom role on MKT and returns its id.
    async function createRole(owner: Actor, name = 'Editor'): Promise<number> {
      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name, permissions: {} });
      return res.data!.id;
    }

    it('assigns a custom role to a member', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const roleId = await createRole(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.find((m) => m.userId === member.user.userId);
      expect(row).toMatchObject({ roleId, roleName: 'Editor' });
    });

    it("clears a member's role with roleId null", async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      const roleId = await createRole(owner);
      await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId });

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.user.userId })
        .patch({ role: 'member', roleId: null });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.find((m) => m.userId === member.user.userId);
      expect(row?.roleId).toBeNull();
    });

    it('returns 404 for a userId that is not a member', async () => {
      const owner = await setupOwner();
      const stranger = await signUpTestUser();
      const roleId = await createRole(owner);

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
      const row = list.data?.find((m) => m.userId === member.user.userId);
      expect(row).toMatchObject({ role: 'owner', roleId: null, roleName: null });
    });

    it('demotes an owner to a member role when another owner remains', async () => {
      const owner = await setupOwner();
      const other = await addMember(owner, 'owner');
      const roleId = await createRole(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: other.user.userId })
        .patch({ role: 'member', roleId });
      expect(res.status).toBe(204);

      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.find((m) => m.userId === other.user.userId);
      expect(row).toMatchObject({ role: 'member', roleId, roleName: 'Editor' });
    });

    it('refuses to change your own role with 400', async () => {
      const owner = await setupOwner();
      const roleId = await createRole(owner);

      const res = await owner.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: owner.user.userId })
        .patch({ role: 'member', roleId });
      expect(res.status).toBe(400);

      // The owner is unchanged.
      const list = await owner.api.projects({ projectKey: 'MKT' }).members.get();
      const row = list.data?.find((m) => m.userId === owner.user.userId);
      expect(row).toMatchObject({ role: 'owner' });
    });

    it('returns 400 when the role belongs to another project', async () => {
      const owner = await setupOwner();
      const member = await addMember(owner);
      // A role created under a different project must not be assignable here.
      await owner.api.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = await owner.api
        .projects({ projectKey: 'OPS' })
        .roles.post({ name: 'Ops', permissions: {} });

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
      const roleId = await createRole(owner);

      const res = await member.api
        .projects({ projectKey: 'MKT' })
        .members({ userId: other.user.userId })
        .patch({ role: 'member', roleId });
      expect(res.status).toBe(403);
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
      expect(res.data?.[0]).toMatchObject({ description: '' });
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
      const row = list.data?.find((m) => m.userId === member.user.userId);
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
      const row = list.data?.find((m) => m.userId === member.user.userId);
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
      const row = list.data?.find((m) => m.userId === member.user.userId);
      expect(row).toMatchObject({ description: 'I do the docs' });
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
      expect(list.data?.map((m) => m.userId)).toEqual([owner.user.userId]);

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
      expect(list.data?.map((m) => m.userId)).toContain(b.user.userId);
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
      expect(list.data?.map((m) => m.userId)).toContain(owner.user.userId);
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
