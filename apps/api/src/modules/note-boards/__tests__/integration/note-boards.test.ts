import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

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
        visibility: 'public',
        memberIds: [],
      });
    });

    it('lets the creator make their board private, hiding it from other members', async () => {
      const owner = await setupOwnerProject();
      const member = await addMember(owner.api);
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;

      const patched = await boards(owner.api)({ boardId }).patch({ visibility: 'private' });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ ownerUserId: owner.userId, visibility: 'private' });

      const read = await boards(member.api)({ boardId }).get();
      expect(read.status).toBe(404);
      const list = await boards(member.api).get({ query: {} });
      expect(list.data).toEqual([]);
    });

    it('rejects making a board private for a member who did not create it', async () => {
      const owner = await setupOwnerProject();
      const member = await addMember(owner.api);
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;

      const res = await boards(member.api)({ boardId }).patch({ visibility: 'private' });
      expect(res.status).toBe(403);

      // The board stays public: renaming it, which any member may do, still works.
      const renamed = await boards(member.api)({ boardId }).patch({ name: 'Shared ideas' });
      expect(renamed.status).toBe(200);
      expect(renamed.data).toMatchObject({ name: 'Shared ideas', ownerUserId: null });
    });

    it('lets the creator make their private board public again', async () => {
      const owner = await setupOwnerProject();
      const member = await addMember(owner.api);
      const boardId = (await boards(member.api).post({ name: 'Mine', visibility: 'private' })).data!
        .id;

      const res = await boards(member.api)({ boardId }).patch({ visibility: 'public' });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        ownerUserId: null,
        createdByUserId: member.userId,
        visibility: 'public',
      });

      const read = await boards(owner.api)({ boardId }).get();
      expect(read.status).toBe(200);
    });
  });

  describe('restricted access', () => {
    it('gives a granted member the board, and hides it from everyone else', async () => {
      const owner = await setupOwnerProject();
      const granted = await addMember(owner.api);
      const other = await addMember(owner.api);
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;

      const patched = await boards(owner.api)({ boardId }).patch({
        visibility: 'restricted',
        memberIds: [granted.userId],
      });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({
        ownerUserId: owner.userId,
        visibility: 'restricted',
        memberIds: [granted.userId],
      });

      expect((await boards(granted.api)({ boardId }).get()).status).toBe(200);
      expect((await boards(granted.api).get({ query: {} })).data).toMatchObject([
        { id: boardId, visibility: 'restricted' },
      ]);

      expect((await boards(other.api)({ boardId }).get()).status).toBe(404);
      expect((await boards(other.api).get({ query: {} })).data).toEqual([]);
    });

    it('replaces the granted members as a whole, revoking the ones left out', async () => {
      const owner = await setupOwnerProject();
      const first = await addMember(owner.api);
      const second = await addMember(owner.api);
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;
      await boards(owner.api)({ boardId }).patch({
        visibility: 'restricted',
        memberIds: [first.userId],
      });

      const patched = await boards(owner.api)({ boardId }).patch({
        visibility: 'restricted',
        memberIds: [second.userId],
      });
      expect(patched.data).toMatchObject({ memberIds: [second.userId] });

      expect((await boards(first.api)({ boardId }).get()).status).toBe(404);
      expect((await boards(second.api)({ boardId }).get()).status).toBe(200);
    });

    it('drops the granted members when the board goes back to public', async () => {
      const owner = await setupOwnerProject();
      const granted = await addMember(owner.api);
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;
      await boards(owner.api)({ boardId }).patch({
        visibility: 'restricted',
        memberIds: [granted.userId],
      });

      const patched = await boards(owner.api)({ boardId }).patch({ visibility: 'public' });
      expect(patched.data).toMatchObject({ visibility: 'public', memberIds: [] });

      // Granting again after that starts from an empty list.
      const restricted = await boards(owner.api)({ boardId }).patch({ visibility: 'restricted' });
      expect(restricted.data).toMatchObject({ visibility: 'private', memberIds: [] });
      expect((await boards(granted.api)({ boardId }).get()).status).toBe(404);
    });

    it('rejects granting access to someone outside the project', async () => {
      const owner = await setupOwnerProject();
      const outsider = await signUpTestUser();
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;

      const res = await boards(owner.api)({ boardId }).patch({
        visibility: 'restricted',
        memberIds: [outsider.userId],
      });
      expect(res.status).toBe(400);
      expect((await boards(owner.api)({ boardId }).get()).data).toMatchObject({
        visibility: 'public',
      });
    });

    it('rejects granting access on a board that is not restricted', async () => {
      const owner = await setupOwnerProject();
      const member = await addMember(owner.api);
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;

      const res = await boards(owner.api)({ boardId }).patch({
        visibility: 'private',
        memberIds: [member.userId],
      });
      expect(res.status).toBe(400);
    });

    it('keeps a granted member from changing who else sees the board', async () => {
      const owner = await setupOwnerProject();
      const granted = await addMember(owner.api);
      const other = await addMember(owner.api);
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;
      await boards(owner.api)({ boardId }).patch({
        visibility: 'restricted',
        memberIds: [granted.userId],
      });

      const res = await boards(granted.api)({ boardId }).patch({
        visibility: 'restricted',
        memberIds: [granted.userId, other.userId],
      });
      expect(res.status).toBe(403);
      expect((await boards(other.api)({ boardId }).get()).status).toBe(404);

      // Editing the board itself stays open to them.
      expect((await boards(granted.api)({ boardId }).patch({ name: 'Ours' })).status).toBe(200);
    });

    it('rejects granting access to a member whose role cannot read notes', async () => {
      const owner = await setupOwnerProject();
      const role = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'No notes', permissions: {} });
      const member = await addMember(owner.api, { roleId: role.data!.id });
      const boardId = (await boards(owner.api).post({ name: 'Ideas' })).data!.id;

      const res = await boards(owner.api)({ boardId }).patch({
        visibility: 'restricted',
        memberIds: [member.userId],
      });
      expect(res.status).toBe(400);
      expect((await boards(owner.api)({ boardId }).get()).data).toMatchObject({
        visibility: 'public',
      });
    });
  });

  describe('access candidates', () => {
    it('lists members and agents, flagging who may read notes', async () => {
      const owner = await setupOwnerProject();
      const member = await addMember(owner.api);
      const role = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'No notes', permissions: {} });
      const noNotes = await addMember(owner.api, { roleId: role.data!.id });
      const agent = await owner.api
        .projects({ projectKey: 'MKT' })
        ['ai-agents'].post({ name: 'Bot', username: 'bot', kind: 'external' });

      const res = await boards(owner.api)['access-candidates'].get();
      expect(res.status).toBe(200);
      const byId = new Map(res.data!.map((c) => [c.userId, c]));
      expect(byId.get(owner.userId)).toMatchObject({ kind: 'member', canAccess: true });
      expect(byId.get(member.userId)).toMatchObject({ kind: 'member', canAccess: true });
      expect(byId.get(noNotes.userId)).toMatchObject({ kind: 'member', canAccess: false });
      expect(byId.get(agent.data!.agent.userId)).toMatchObject({ kind: 'agent' });
    });

    it('holds a read-only role out of the candidate list', async () => {
      const owner = await setupOwnerProject();
      const role = await owner.api
        .projects({ projectKey: 'MKT' })
        .roles.post({ name: 'Reader', permissions: { note_boards: { read: true } } });
      const member = await addMember(owner.api, { roleId: role.data!.id });

      expect((await boards(member.api)['access-candidates'].get()).status).toBe(403);
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
