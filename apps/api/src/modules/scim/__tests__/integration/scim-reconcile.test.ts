import { describe, expect, it, beforeEach } from 'bun:test';
import { resetDb } from '#tests/helpers/db';
import { addUser, joinProject, type Actor } from '#modules/god/__tests__/helpers';
import { patchOps, scimUserBody, setupScim, type ScimSetup } from '../helpers';

// What a provisioned group grants: the mappings the instance owner declares in god
// mode turn group membership into project membership. Only the rows the sync owns
// are ever touched, so a membership somebody set up through an invite survives.

async function createProject(owner: Actor, name: string, key: string) {
  const created = await owner.api.projects.post({ name, key });
  return created.data!;
}

async function membersOf(owner: Actor, projectKey: string) {
  const res = await owner.api.projects({ projectKey }).members.get();
  return res.data!;
}

async function provisionGroup(setup: ScimSetup, displayName: string, memberIds: string[]) {
  const created = await setup.scim.scim.v2.Groups.post({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    displayName,
    members: memberIds.map((value) => ({ value })),
  });
  return created.data!.id;
}

describe('SCIM group reconciliation', () => {
  beforeEach(resetDb);

  it('grants membership at the mapped role when a group is mapped', async () => {
    const setup = await setupScim();
    const project = await createProject(setup.god, 'Marketing', 'MKT');
    const ada = await setup.scim.scim.v2.Users.post(scimUserBody());
    const groupId = await provisionGroup(setup, 'Engineering', [ada.data!.id]);

    const res = await setup.god.api.god['scim-groups']({ groupId }).mappings.put({
      mappings: [{ projectId: project.id, role: 'member', roleId: null }],
    });

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      displayName: 'Engineering',
      memberCount: 1,
      mappings: [{ projectId: project.id, projectKey: 'MKT', role: 'member' }],
    });

    const members = await membersOf(setup.god, 'MKT');
    expect(members).toContainEqual(
      expect.objectContaining({ userId: ada.data!.id, role: 'member', source: 'scim' }),
    );
  });

  it('assigns the project role named in the mapping', async () => {
    const setup = await setupScim();
    const project = await createProject(setup.god, 'Marketing', 'MKT');
    const role = await setup.god.api.projects({ projectKey: 'MKT' }).roles.post({
      name: 'Reviewer',
      permissions: {},
    });
    const ada = await setup.scim.scim.v2.Users.post(scimUserBody());
    const groupId = await provisionGroup(setup, 'Engineering', [ada.data!.id]);

    await setup.god.api.god['scim-groups']({ groupId }).mappings.put({
      mappings: [{ projectId: project.id, role: 'member', roleId: role.data!.id }],
    });

    const members = await membersOf(setup.god, 'MKT');
    expect(members).toContainEqual(
      expect.objectContaining({ userId: ada.data!.id, roleId: role.data!.id }),
    );
  });

  it('revokes membership when the member leaves the group', async () => {
    const setup = await setupScim();
    const project = await createProject(setup.god, 'Marketing', 'MKT');
    const ada = await setup.scim.scim.v2.Users.post(scimUserBody());
    const groupId = await provisionGroup(setup, 'Engineering', [ada.data!.id]);
    await setup.god.api.god['scim-groups']({ groupId }).mappings.put({
      mappings: [{ projectId: project.id, role: 'member', roleId: null }],
    });

    await setup.scim.scim.v2
      .Groups({ id: groupId })
      .patch(patchOps([{ op: 'remove', path: 'members', value: [{ value: ada.data!.id }] }]));

    const members = await membersOf(setup.god, 'MKT');
    expect(members.map((m) => m.userId)).not.toContain(ada.data!.id);
  });

  it('revokes membership when the group is unmapped, and when it is deleted', async () => {
    const setup = await setupScim();
    const project = await createProject(setup.god, 'Marketing', 'MKT');
    const ada = await setup.scim.scim.v2.Users.post(scimUserBody());
    const groupId = await provisionGroup(setup, 'Engineering', [ada.data!.id]);
    const mapTo = (mappings: { projectId: number; role: 'owner' | 'member'; roleId: null }[]) =>
      setup.god.api.god['scim-groups']({ groupId }).mappings.put({ mappings });

    await mapTo([{ projectId: project.id, role: 'member', roleId: null }]);
    await mapTo([]);
    expect((await membersOf(setup.god, 'MKT')).map((m) => m.userId)).not.toContain(ada.data!.id);

    await mapTo([{ projectId: project.id, role: 'member', roleId: null }]);
    expect((await membersOf(setup.god, 'MKT')).map((m) => m.userId)).toContain(ada.data!.id);

    await setup.scim.scim.v2.Groups({ id: groupId }).delete();
    expect((await membersOf(setup.god, 'MKT')).map((m) => m.userId)).not.toContain(ada.data!.id);
  });

  it('leaves a membership that came from an invite alone', async () => {
    const setup = await setupScim();
    const project = await createProject(setup.god, 'Marketing', 'MKT');
    const invited = await addUser({ email: 'invited@example.com' });
    await joinProject(setup.god, invited, 'MKT', 'member');
    const groupId = await provisionGroup(setup, 'Engineering', [invited.id]);

    // Mapped as owner, but the invited membership outranks it and is not re-roled.
    await setup.god.api.god['scim-groups']({ groupId }).mappings.put({
      mappings: [{ projectId: project.id, role: 'owner', roleId: null }],
    });
    let members = await membersOf(setup.god, 'MKT');
    expect(members).toContainEqual(
      expect.objectContaining({ userId: invited.id, role: 'member', source: 'invite' }),
    );

    // And removing them from the group does not take the invited membership away.
    await setup.scim.scim.v2
      .Groups({ id: groupId })
      .patch(patchOps([{ op: 'remove', path: 'members', value: [{ value: invited.id }] }]));
    members = await membersOf(setup.god, 'MKT');
    expect(members.map((m) => m.userId)).toContain(invited.id);
  });

  it('resolves a user in two mappings to the stronger role', async () => {
    const setup = await setupScim();
    const project = await createProject(setup.god, 'Marketing', 'MKT');
    const ada = await setup.scim.scim.v2.Users.post(scimUserBody());
    const members = await provisionGroup(setup, 'Members', [ada.data!.id]);
    const leads = await provisionGroup(setup, 'Leads', [ada.data!.id]);

    await setup.god.api.god['scim-groups']({ groupId: members }).mappings.put({
      mappings: [{ projectId: project.id, role: 'member', roleId: null }],
    });
    await setup.god.api.god['scim-groups']({ groupId: leads }).mappings.put({
      mappings: [{ projectId: project.id, role: 'owner', roleId: null }],
    });

    expect(await membersOf(setup.god, 'MKT')).toContainEqual(
      expect.objectContaining({ userId: ada.data!.id, role: 'owner' }),
    );
  });

  it('keeps the last owner even when the group no longer grants it', async () => {
    const setup = await setupScim();
    const project = await createProject(setup.god, 'Marketing', 'MKT');
    const ada = await setup.scim.scim.v2.Users.post(scimUserBody());
    const groupId = await provisionGroup(setup, 'Leads', [ada.data!.id]);
    await setup.god.api.god['scim-groups']({ groupId }).mappings.put({
      mappings: [{ projectId: project.id, role: 'owner', roleId: null }],
    });
    // The creator leaves, which the second owner makes possible. The project is
    // now owned by the provisioned membership alone.
    await setup.god.api.projects({ projectKey: 'MKT' }).members({ userId: setup.god.id }).delete();

    await setup.scim.scim.v2
      .Groups({ id: groupId })
      .patch(patchOps([{ op: 'remove', path: 'members', value: [{ value: ada.data!.id }] }]));

    // Read through god mode: the creator is no longer a member, so the project's
    // own members route is closed to them.
    const detail = await setup.god.api.god.users({ userId: ada.data!.id }).get();
    expect(detail.data!.projects).toContainEqual(
      expect.objectContaining({ projectKey: 'MKT', role: 'owner' }),
    );
  });

  it('refuses to edit or remove a membership the sync owns', async () => {
    const setup = await setupScim();
    const project = await createProject(setup.god, 'Marketing', 'MKT');
    const ada = await setup.scim.scim.v2.Users.post(scimUserBody());
    const groupId = await provisionGroup(setup, 'Engineering', [ada.data!.id]);
    await setup.god.api.god['scim-groups']({ groupId }).mappings.put({
      mappings: [{ projectId: project.id, role: 'member', roleId: null }],
    });

    const promoted = await setup.god.api
      .projects({ projectKey: 'MKT' })
      .members({ userId: ada.data!.id })
      .patch({ role: 'owner' });
    expect(promoted.status).toBe(409);
    expect(promoted.error!.value).toMatchObject({ error: 'This membership is managed by SCIM' });

    const removed = await setup.god.api
      .projects({ projectKey: 'MKT' })
      .members({ userId: ada.data!.id })
      .delete();
    expect(removed.status).toBe(409);
  });

  describe('mapping validation', () => {
    it('404s an unknown group', async () => {
      const setup = await setupScim();

      const res = await setup.god.api.god['scim-groups']({
        groupId: '00000000-0000-4000-8000-000000000000',
      }).mappings.put({ mappings: [] });

      expect(res.status).toBe(404);
    });

    it('refuses an unknown project', async () => {
      const setup = await setupScim();
      const groupId = await provisionGroup(setup, 'Engineering', []);

      const res = await setup.god.api.god['scim-groups']({ groupId }).mappings.put({
        mappings: [{ projectId: 987654, role: 'member', roleId: null }],
      });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({ error: 'Unknown project' });
    });

    it('refuses a role that belongs to another project', async () => {
      const setup = await setupScim();
      const marketing = await createProject(setup.god, 'Marketing', 'MKT');
      await createProject(setup.god, 'Design', 'DSN');
      const role = await setup.god.api.projects({ projectKey: 'DSN' }).roles.post({
        name: 'Reviewer',
        permissions: {},
      });
      const groupId = await provisionGroup(setup, 'Engineering', []);

      const res = await setup.god.api.god['scim-groups']({ groupId }).mappings.put({
        mappings: [{ projectId: marketing.id, role: 'member', roleId: role.data!.id }],
      });

      expect(res.status).toBe(400);
      expect(res.error!.value).toMatchObject({
        error: 'The role does not belong to that project',
      });
    });

    it('refuses the same project twice', async () => {
      const setup = await setupScim();
      const project = await createProject(setup.god, 'Marketing', 'MKT');
      const groupId = await provisionGroup(setup, 'Engineering', []);

      const res = await setup.god.api.god['scim-groups']({ groupId }).mappings.put({
        mappings: [
          { projectId: project.id, role: 'member', roleId: null },
          { projectId: project.id, role: 'owner', roleId: null },
        ],
      });

      expect(res.status).toBe(400);
    });

    it('refuses a plain user', async () => {
      const setup = await setupScim();
      const user = await addUser({ email: 'someone@example.com' });
      const groupId = await provisionGroup(setup, 'Engineering', []);

      expect((await user.api.god['scim-groups'].get()).status).toBe(403);
      expect(
        (await user.api.god['scim-groups']({ groupId }).mappings.put({ mappings: [] })).status,
      ).toBe(403);
    });
  });

  // A directory that never calls POST /Groups still grants access this way: it
  // embeds the groups a user belongs to right on the user payload, which is what
  // "push groups" means in some identity providers instead of a separate sync.
  describe('groups embedded on a user', () => {
    it('creates the group from a userless sync and adds the account to it', async () => {
      const setup = await setupScim();

      const created = await setup.scim.scim.v2.Users.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'ada@example.com',
        emails: [{ value: 'ada@example.com', primary: true }],
        groups: [{ display: 'Engineering' }],
      });

      const groups = await setup.god.api.god['scim-groups'].get();
      expect(groups.data).toContainEqual(
        expect.objectContaining({ displayName: 'Engineering', memberCount: 1 }),
      );
      expect(groups.data!.find((g) => g.displayName === 'Engineering')!.mappings).toEqual([]);
      expect(created.status).toBe(201);
    });

    it('falls back to value when the provider sends no display name', async () => {
      const setup = await setupScim();

      await setup.scim.scim.v2.Users.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'ada@example.com',
        emails: [{ value: 'ada@example.com', primary: true }],
        groups: [{ value: 'Engineering' }],
      });

      const groups = await setup.god.api.god['scim-groups'].get();
      expect(groups.data).toContainEqual(
        expect.objectContaining({ displayName: 'Engineering', memberCount: 1 }),
      );
    });

    // The same parser reads an OIDC `groups` claim, which is conventionally a bare
    // array of names rather than SCIM's `{ value, display }` refs.
    it('accepts a plain array of group names', async () => {
      const setup = await setupScim();

      await setup.scim.scim.v2.Users.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'ada@example.com',
        emails: [{ value: 'ada@example.com', primary: true }],
        groups: ['Engineering', 'Design'],
      });

      const groups = await setup.god.api.god['scim-groups'].get();
      expect(groups.data!.map((g) => g.displayName).sort()).toEqual(['Design', 'Engineering']);
    });

    it('grants project access right away when the group is already mapped', async () => {
      const setup = await setupScim();
      const project = await createProject(setup.god, 'Marketing', 'MKT');
      const groupId = await provisionGroup(setup, 'Engineering', []);
      await setup.god.api.god['scim-groups']({ groupId }).mappings.put({
        mappings: [{ projectId: project.id, role: 'member', roleId: null }],
      });

      const created = await setup.scim.scim.v2.Users.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'ada@example.com',
        emails: [{ value: 'ada@example.com', primary: true }],
        groups: [{ display: 'Engineering' }],
      });

      const members = await membersOf(setup.god, 'MKT');
      expect(members).toContainEqual(
        expect.objectContaining({ userId: created.data!.id, role: 'member', source: 'scim' }),
      );
    });

    it('does not duplicate a group already pushed through POST /Groups', async () => {
      const setup = await setupScim();
      const groupId = await provisionGroup(setup, 'Engineering', []);

      await setup.scim.scim.v2.Users.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'ada@example.com',
        emails: [{ value: 'ada@example.com', primary: true }],
        groups: [{ display: 'Engineering' }],
      });

      const groups = await setup.god.api.god['scim-groups'].get();
      expect(groups.data!.filter((g) => g.displayName === 'Engineering')).toHaveLength(1);
      expect(groups.data!.find((g) => g.id === groupId)!.memberCount).toBe(1);
    });

    it('adds an updated group without removing the ones already there', async () => {
      const setup = await setupScim();

      const created = await setup.scim.scim.v2.Users.post({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'ada@example.com',
        emails: [{ value: 'ada@example.com', primary: true }],
        groups: [{ display: 'Engineering' }],
      });
      await setup.scim.scim.v2.Users({ id: created.data!.id }).put({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: 'ada@example.com',
        emails: [{ value: 'ada@example.com', primary: true }],
        groups: [{ display: 'Design' }],
      });

      const groups = await setup.god.api.god['scim-groups'].get();
      expect(groups.data!.find((g) => g.displayName === 'Engineering')!.memberCount).toBe(1);
      expect(groups.data!.find((g) => g.displayName === 'Design')!.memberCount).toBe(1);
    });
  });
});
