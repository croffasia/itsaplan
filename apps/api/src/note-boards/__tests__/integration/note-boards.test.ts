import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

type Client = ReturnType<typeof authedApi>;

async function setupOwnerProject(): Promise<{ api: Client; userId: string }> {
  const owner = await signUpTestUser();
  const api = authedApi(owner.cookie);
  await api.projects.post({ key: 'MKT', name: 'Marketing' });
  return { api, userId: owner.userId };
}

// Adds a member to project MKT through the invite flow, optionally on a custom role.
async function addMember(
  owner: Client,
  opts: { roleId?: number } = {},
): Promise<{ api: Client; userId: string }> {
  const user = await signUpTestUser();
  const invite = await owner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member' });
  const api = authedApi(user.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  if (opts.roleId != null) {
    await owner
      .projects({ projectKey: 'MKT' })
      .members({ userId: user.userId })
      .patch({ role: 'member', roleId: opts.roleId });
  }
  return { api, userId: user.userId };
}

function boards(api: Client) {
  return api.projects({ projectKey: 'MKT' })['note-boards'];
}

describe('note boards', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('creator', () => {
    it('records the creator on a new board', async () => {
      const owner = await setupOwnerProject();

      const created = await boards(owner.api).post({ name: 'Ideas' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        name: 'Ideas',
        ownerUserId: null,
        createdByUserId: owner.userId,
      });
    });

    it('lets the creator make their board private, hiding it from other members', async () => {
      const owner = await setupOwnerProject();
      const member = await addMember(owner.api);
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;

      const patched = await boards(owner.api)({ boardId }).patch({ personal: true });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ ownerUserId: owner.userId });

      const read = await boards(member.api)({ boardId }).get();
      expect(read.status).toBe(404);
      const list = await boards(member.api).get({ query: {} });
      expect(list.data).toEqual([]);
    });

    it('rejects making a board private for a member who did not create it', async () => {
      const owner = await setupOwnerProject();
      const member = await addMember(owner.api);
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;

      const res = await boards(member.api)({ boardId }).patch({ personal: true });
      expect(res.status).toBe(403);

      // The board stays public: renaming it, which any member may do, still works.
      const renamed = await boards(member.api)({ boardId }).patch({ name: 'Shared ideas' });
      expect(renamed.status).toBe(200);
      expect(renamed.data).toMatchObject({ name: 'Shared ideas', ownerUserId: null });
    });

    it('lets any member make a personal board public again', async () => {
      const owner = await setupOwnerProject();
      const member = await addMember(owner.api);
      const boardId = (await boards(member.api).post({ name: 'Mine', personal: true })).data!.id;

      const res = await boards(member.api)({ boardId }).patch({ personal: false });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ ownerUserId: null, createdByUserId: member.userId });

      const read = await boards(owner.api)({ boardId }).get();
      expect(read.status).toBe(200);
    });
  });

  describe('permissions', () => {
    it('grants the default member role every note board action', async () => {
      const owner = await setupOwnerProject();
      const member = await addMember(owner.api);

      const created = await boards(member.api).post({ name: 'Ideas' });
      expect(created.status).toBe(201);
      const boardId = created.data!.id;

      expect((await boards(member.api).get({ query: {} })).status).toBe(200);
      expect((await boards(member.api)({ boardId }).patch({ name: 'Renamed' })).status).toBe(200);
      expect((await boards(member.api)({ boardId }).delete()).status).toBe(204);
    });

    it('holds a role without the note_boards resource out of the section', async () => {
      const owner = await setupOwnerProject();
      const role = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'No notes', permissions: {} });
      const member = await addMember(owner.api, { roleId: role.data!.id });
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;

      expect((await boards(member.api).get({ query: {} })).status).toBe(403);
      expect((await boards(member.api)({ boardId }).get()).status).toBe(403);
      expect((await boards(member.api).post({ name: 'Nope' })).status).toBe(403);
      expect((await boards(member.api)({ boardId }).patch({ name: 'Nope' })).status).toBe(403);
      expect((await boards(member.api)({ boardId }).delete()).status).toBe(403);
    });

    it('lets a read-only role read boards but not change them', async () => {
      const owner = await setupOwnerProject();
      const role = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Reader', permissions: { note_boards: { read: true } } });
      const member = await addMember(owner.api, { roleId: role.data!.id });
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;

      expect((await boards(member.api)({ boardId }).get()).status).toBe(200);
      expect((await boards(member.api)({ boardId }).patch({ name: 'Nope' })).status).toBe(403);
      expect((await boards(member.api)({ boardId }).delete()).status).toBe(403);
    });
  });
});
