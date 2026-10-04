import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser, type TestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The first account is the owner of the instance workspace; every account signed up
// with a team is a person in it.
async function setup() {
  const owner = await signUpTestUser();
  const ownerApi = authedApi(owner.cookie);
  const [workspace] = (await ownerApi.workspaces.get()).data!;
  return { owner, ownerApi, workspaceId: workspace!.id };
}

async function makeAdmin(
  ownerApi: ReturnType<typeof authedApi>,
  workspaceId: number,
  person: TestUser,
) {
  const res = await ownerApi.workspaces({ workspaceId }).managers.post({ userId: person.userId });
  expect(res.status).toBe(201);
}

describe('workspaces', () => {
  beforeEach(resetDb);

  describe('GET /workspaces', () => {
    it('lists the workspace with the standing of each reader', async () => {
      const { ownerApi, workspaceId } = await setup();
      const member = await signUpTestUser();
      const outsider = await signUpTestUser({ team: false });

      expect((await ownerApi.workspaces.get()).data).toEqual([
        { id: workspaceId, name: 'Workspace', role: 'owner' },
      ]);
      expect((await authedApi(member.cookie).workspaces.get()).data).toEqual([
        { id: workspaceId, name: 'Workspace', role: null },
      ]);
      expect((await authedApi(outsider.cookie).workspaces.get()).data).toEqual([]);
    });
  });

  describe('GET /workspaces/:workspaceId', () => {
    it('answers a manager with the counts', async () => {
      const { ownerApi, workspaceId } = await setup();
      await signUpTestUser();

      const res = await ownerApi.workspaces({ workspaceId }).get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ role: 'owner', managerCount: 1 });
    });

    it('answers 404 to somebody who does not manage it', async () => {
      const { workspaceId } = await setup();
      const member = await signUpTestUser();

      expect((await authedApi(member.cookie).workspaces({ workspaceId }).get()).status).toBe(404);
    });
  });

  describe('PATCH /workspaces/:workspaceId', () => {
    it('renames it for an admin', async () => {
      const { ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);

      const res = await authedApi(admin.cookie).workspaces({ workspaceId }).patch({ name: 'Acme' });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ name: 'Acme', role: 'admin' });
    });

    it('refuses an empty name and one past 60 characters', async () => {
      const { ownerApi, workspaceId } = await setup();

      expect((await ownerApi.workspaces({ workspaceId }).patch({ name: '' })).status).toBe(400);
      expect(
        (await ownerApi.workspaces({ workspaceId }).patch({ name: 'a'.repeat(61) })).status,
      ).toBe(400);
      expect(
        (await ownerApi.workspaces({ workspaceId }).patch({ name: 'a'.repeat(60) })).status,
      ).toBe(200);
    });
  });

  describe('managers', () => {
    it('lists the owner first, then the admins', async () => {
      const { owner, ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);

      const res = await ownerApi.workspaces({ workspaceId }).managers.get();
      expect(res.data!.map((m) => [m.userId, m.role])).toEqual([
        [owner.userId, 'owner'],
        [admin.userId, 'admin'],
      ]);
    });

    it('offers the people of its teams who do not manage it yet', async () => {
      const { ownerApi, workspaceId } = await setup();
      const member = await signUpTestUser({ name: 'Grace Hopper' });
      await signUpTestUser({ name: 'Ada Lovelace', team: false });

      const all = await ownerApi.workspaces({ workspaceId }).managers.candidates.get();
      expect(all.data!.map((c) => c.userId)).toEqual([member.userId]);
      const none = await ownerApi
        .workspaces({ workspaceId })
        .managers.candidates.get({ query: { search: 'ada' } });
      expect(none.data).toEqual([]);
    });

    it('refuses somebody outside its teams and somebody already managing it', async () => {
      const { owner, ownerApi, workspaceId } = await setup();
      const outsider = await signUpTestUser({ team: false });
      const managers = ownerApi.workspaces({ workspaceId }).managers;

      expect((await managers.post({ userId: outsider.userId })).status).toBe(404);
      expect((await managers.post({ userId: owner.userId })).status).toBe(409);
    });

    it('lets only the owner appoint and remove admins', async () => {
      const { ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      const other = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);
      const adminManagers = authedApi(admin.cookie).workspaces({ workspaceId }).managers;

      expect((await adminManagers.post({ userId: other.userId })).status).toBe(403);
      expect((await adminManagers({ userId: admin.userId }).delete()).status).toBe(403);
    });

    it('removes an admin but never the owner', async () => {
      const { owner, ownerApi, workspaceId } = await setup();
      const admin = await signUpTestUser();
      await makeAdmin(ownerApi, workspaceId, admin);
      const managers = ownerApi.workspaces({ workspaceId }).managers;

      expect((await managers({ userId: admin.userId }).delete()).status).toBe(204);
      expect((await managers({ userId: admin.userId }).delete()).status).toBe(404);
      expect((await managers({ userId: owner.userId }).delete()).status).toBe(409);
      expect((await authedApi(admin.cookie).workspaces({ workspaceId }).get()).status).toBe(404);
    });
  });
});
