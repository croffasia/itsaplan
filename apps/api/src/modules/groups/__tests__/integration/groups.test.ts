import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// A project group is a named set of the project's members that an issue can be
// assigned to, alongside or instead of one person. The group list rides on the project
// view (GET /projects/:projectKey) and has its own list route; writes use the labels
// permission. A user leaving the project leaves its groups, and deleting a group clears
// it from the issues assigned to it.

interface Member {
  api: Api;
  userId: string;
}

async function setup() {
  const u = await signUpTestUser();
  const asOwner = authedApi(u.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  return { asOwner, ownerId: u.userId, columnId: view.data!.columns[0].id };
}

async function addMember(asOwner: Api, key = 'MKT'): Promise<Member> {
  const u = await signUpTestUser();
  const invite = await asOwner
    .projects({ projectKey: key })
    .invites.post({ email: u.email, role: 'member' });
  const api = authedApi(u.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  return { api, userId: u.userId };
}

function groupsOf(client: Api, key = 'MKT') {
  return client.projects({ projectKey: key }).groups.get();
}

describe('project groups', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create', () => {
    it('creates a group with members and lists it in the project view and the list route', async () => {
      const { asOwner, ownerId } = await setup();
      const member = await addMember(asOwner);

      const created = await asOwner
        .projects({ projectKey: 'MKT' })
        .groups.post({ name: 'Pharmacy', color: '#112233', memberIds: [member.userId, ownerId] });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ name: 'Pharmacy', color: '#112233' });
      expect([...created.data!.memberIds].sort()).toEqual([member.userId, ownerId].sort());

      const view = await asOwner.projects({ projectKey: 'MKT' }).get();
      expect(view.data!.groups.map((g) => g.name)).toEqual(['Pharmacy']);
      const listed = await groupsOf(member.api);
      expect(listed.status).toBe(200);
      expect(listed.data!.map((g) => g.id)).toEqual([created.data!.id]);
    });

    it('defaults the color and puts new groups after existing ones', async () => {
      const { asOwner } = await setup();
      const scope = asOwner.projects({ projectKey: 'MKT' }).groups;
      await scope.post({ name: 'Nursing' });
      const second = await scope.post({ name: 'Facilities' });
      expect(second.data).toMatchObject({ color: '#6b7280', memberIds: [] });
      expect((await groupsOf(asOwner)).data!.map((g) => g.name)).toEqual(['Nursing', 'Facilities']);
    });

    it('rejects a duplicate name regardless of case with 409', async () => {
      const { asOwner } = await setup();
      const scope = asOwner.projects({ projectKey: 'MKT' }).groups;
      await scope.post({ name: 'Nursing' });
      const dup = await scope.post({ name: 'nursing' });
      expect(dup.status).toBe(409);
    });

    it('allows the same name in another project', async () => {
      const { asOwner } = await setup();
      await createProject(asOwner, { key: 'OPS', name: 'Operations' });
      await asOwner.projects({ projectKey: 'MKT' }).groups.post({ name: 'Nursing' });
      const other = await asOwner.projects({ projectKey: 'OPS' }).groups.post({ name: 'Nursing' });
      expect(other.status).toBe(201);
    });

    it('rejects an empty name with 400', async () => {
      const { asOwner } = await setup();
      const res = await asOwner.projects({ projectKey: 'MKT' }).groups.post({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a member id that is not a project member with 400', async () => {
      const { asOwner } = await setup();
      const stranger = await signUpTestUser();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .groups.post({ name: 'Nursing', memberIds: [stranger.userId] });
      expect(res.status).toBe(400);
      expect((await groupsOf(asOwner)).data).toEqual([]);
    });
  });

  describe('update and delete', () => {
    it('renames and recolors a group', async () => {
      const { asOwner } = await setup();
      const group = (await asOwner.projects({ projectKey: 'MKT' }).groups.post({ name: 'A' }))
        .data!;
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .groups({ groupId: group.id })
        .patch({ name: 'B', color: '#abcdef' });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: group.id, name: 'B', color: '#abcdef' });
    });

    it('answers 409 when the new name is taken and 404 for an unknown group', async () => {
      const { asOwner } = await setup();
      const scope = asOwner.projects({ projectKey: 'MKT' }).groups;
      await scope.post({ name: 'A' });
      const b = (await scope.post({ name: 'B' })).data!;
      expect((await scope({ groupId: b.id }).patch({ name: 'a' })).status).toBe(409);
      expect((await scope({ groupId: 999999 }).patch({ name: 'C' })).status).toBe(404);
    });

    it('deletes a group', async () => {
      const { asOwner } = await setup();
      const group = (await asOwner.projects({ projectKey: 'MKT' }).groups.post({ name: 'A' }))
        .data!;
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .groups({ groupId: group.id })
        .delete();
      expect(res.status).toBe(204);
      expect((await groupsOf(asOwner)).data).toEqual([]);
    });

    it('clears the group from issues assigned to it when it is deleted', async () => {
      const { asOwner, columnId } = await setup();
      const group = (await asOwner.projects({ projectKey: 'MKT' }).groups.post({ name: 'A' }))
        .data!;
      const issue = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          .issues.post({ columnId, title: 'Task', assigneeGroupId: group.id })
      ).data!;
      expect(issue.assigneeGroupId).toBe(group.id);

      await asOwner.projects({ projectKey: 'MKT' }).groups({ groupId: group.id }).delete();
      const after = await asOwner.issues({ issueId: issue.id }).get();
      expect(after.data!.assigneeGroupId).toBeNull();
    });
  });

  describe('members', () => {
    it('adds, sets and removes members', async () => {
      const { asOwner, ownerId } = await setup();
      const a = await addMember(asOwner);
      const b = await addMember(asOwner);
      const group = (await asOwner.projects({ projectKey: 'MKT' }).groups.post({ name: 'G' }))
        .data!;
      const scope = asOwner.projects({ projectKey: 'MKT' }).groups({ groupId: group.id }).members;

      const added = await scope.post({ userIds: [a.userId, a.userId] });
      expect(added.data!.memberIds).toEqual([a.userId]);

      const set = await scope.put({ userIds: [b.userId, ownerId] });
      expect([...set.data!.memberIds].sort()).toEqual([b.userId, ownerId].sort());

      const removed = await scope({ userId: b.userId }).delete();
      expect(removed.status).toBe(204);
      expect((await groupsOf(asOwner)).data![0].memberIds).toEqual([ownerId]);
    });

    it('rejects a user who is not a project member with 400', async () => {
      const { asOwner } = await setup();
      const stranger = await signUpTestUser();
      const group = (await asOwner.projects({ projectKey: 'MKT' }).groups.post({ name: 'G' }))
        .data!;
      const scope = asOwner.projects({ projectKey: 'MKT' }).groups({ groupId: group.id }).members;
      expect((await scope.post({ userIds: [stranger.userId] })).status).toBe(400);
      expect((await scope.put({ userIds: [stranger.userId] })).status).toBe(400);
    });

    it('drops a user from its groups when they leave the project', async () => {
      const { asOwner } = await setup();
      const member = await addMember(asOwner);
      const group = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          .groups.post({ name: 'G', memberIds: [member.userId] })
      ).data!;
      expect(group.memberIds).toEqual([member.userId]);

      const removed = await asOwner
        .projects({ projectKey: 'MKT' })
        .members({ userId: member.userId })
        .delete();
      expect(removed.status).toBe(204);
      expect((await groupsOf(asOwner)).data![0].memberIds).toEqual([]);
    });
  });

  describe('access', () => {
    it('lets a member read but not write, and keeps non-members out', async () => {
      const { asOwner } = await setup();
      const member = await addMember(asOwner);
      const outsider = authedApi((await signUpTestUser()).cookie);
      const group = (await asOwner.projects({ projectKey: 'MKT' }).groups.post({ name: 'G' }))
        .data!;

      expect((await groupsOf(member.api)).status).toBe(200);
      const scope = member.api.projects({ projectKey: 'MKT' }).groups;
      expect((await scope.post({ name: 'X' })).status).toBe(403);
      expect((await scope({ groupId: group.id }).patch({ name: 'Y' })).status).toBe(403);
      expect((await scope({ groupId: group.id }).delete()).status).toBe(403);
      expect((await scope({ groupId: group.id }).members.put({ userIds: [] })).status).toBe(403);

      expect((await groupsOf(outsider)).status).toBe(403);
    });

    it('does not reach a group of another project', async () => {
      const { asOwner } = await setup();
      await createProject(asOwner, { key: 'OPS', name: 'Operations' });
      const group = (await asOwner.projects({ projectKey: 'OPS' }).groups.post({ name: 'G' }))
        .data!;
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .groups({ groupId: group.id })
        .patch({ name: 'Z' });
      expect(res.status).toBe(404);
    });
  });

  describe('issue assignment', () => {
    it('assigns an issue to a group on create and update and returns it everywhere', async () => {
      const { asOwner, columnId } = await setup();
      const group = (await asOwner.projects({ projectKey: 'MKT' }).groups.post({ name: 'G' }))
        .data!;
      const scope = asOwner.projects({ projectKey: 'MKT' });
      const issue = (await scope.issues.post({ columnId, title: 'Task' })).data!;
      expect(issue.assigneeGroupId).toBeNull();

      const patched = await asOwner
        .issues({ issueId: issue.id })
        .patch({ assigneeGroupId: group.id });
      expect(patched.data).toMatchObject({ assigneeGroupId: group.id });
      expect((await asOwner.issues({ issueId: issue.id }).get()).data!.assigneeGroupId).toBe(
        group.id,
      );

      const board = await scope.issues.board.get();
      expect(board.data!.issues.find((i) => i.id === issue.id)!.assigneeGroupId).toBe(group.id);

      const search = await scope.issues.get({ query: { assigneeGroupId: group.id } });
      expect(search.data!.map((i) => i.id)).toEqual([issue.id]);
      expect(search.data![0].assigneeGroupId).toBe(group.id);

      const cleared = await asOwner.issues({ issueId: issue.id }).patch({ assigneeGroupId: null });
      expect(cleared.data!.assigneeGroupId).toBeNull();
    });

    it('filters the list by group', async () => {
      const { asOwner, columnId } = await setup();
      const scope = asOwner.projects({ projectKey: 'MKT' });
      const g1 = (await scope.groups.post({ name: 'G1' })).data!;
      const g2 = (await scope.groups.post({ name: 'G2' })).data!;
      const i1 = (await scope.issues.post({ columnId, title: 'one', assigneeGroupId: g1.id }))
        .data!;
      await scope.issues.post({ columnId, title: 'two', assigneeGroupId: g2.id });
      await scope.issues.post({ columnId, title: 'three' });

      const res = await scope.issues.get({ query: { assigneeGroupId: g1.id } });
      expect(res.data!.map((i) => i.id)).toEqual([i1.id]);
    });

    it('assigns by group name', async () => {
      const { asOwner, columnId } = await setup();
      const scope = asOwner.projects({ projectKey: 'MKT' });
      const group = (await scope.groups.post({ name: 'Pharmacy' })).data!;
      const created = await scope.issues.post({
        columnId,
        title: 'Task',
        assigneeGroupName: 'pharmacy',
      });
      expect(created.data!.assigneeGroupId).toBe(group.id);

      const other = (await scope.issues.post({ columnId, title: 'Other' })).data!;
      const patched = await asOwner
        .issues({ issueId: other.id })
        .patch({ assigneeGroupName: 'Pharmacy' });
      expect(patched.data!.assigneeGroupId).toBe(group.id);

      const unknown = await asOwner
        .issues({ issueId: other.id })
        .patch({ assigneeGroupName: 'Nope' });
      expect(unknown.status).toBe(400);
    });

    it('rejects a group of another project with 400', async () => {
      const { asOwner, columnId } = await setup();
      await createProject(asOwner, { key: 'OPS', name: 'Operations' });
      const foreign = (await asOwner.projects({ projectKey: 'OPS' }).groups.post({ name: 'G' }))
        .data!;
      const scope = asOwner.projects({ projectKey: 'MKT' });

      const created = await scope.issues.post({
        columnId,
        title: 'Task',
        assigneeGroupId: foreign.id,
      });
      expect(created.status).toBe(400);

      const issue = (await scope.issues.post({ columnId, title: 'Task' })).data!;
      const patched = await asOwner
        .issues({ issueId: issue.id })
        .patch({ assigneeGroupId: foreign.id });
      expect(patched.status).toBe(400);
    });

    it('bulk-assigns issues to a group', async () => {
      const { asOwner, columnId } = await setup();
      const scope = asOwner.projects({ projectKey: 'MKT' });
      const group = (await scope.groups.post({ name: 'G' })).data!;
      const a = (await scope.issues.post({ columnId, title: 'a' })).data!;
      const b = (await scope.issues.post({ columnId, title: 'b' })).data!;
      const res = await scope.issues.bulk.patch({
        ids: [a.id, b.id],
        patch: { assigneeGroupId: group.id },
      });
      expect(res.status).toBe(200);
      const board = (await scope.issues.board.get()).data!.issues;
      expect(board.filter((i) => i.assigneeGroupId === group.id)).toHaveLength(2);
    });

    it('records the assignment in the issue activity', async () => {
      const { asOwner, columnId } = await setup();
      const scope = asOwner.projects({ projectKey: 'MKT' });
      const group = (await scope.groups.post({ name: 'Pharmacy' })).data!;
      const issue = (await scope.issues.post({ columnId, title: 'Task' })).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ assigneeGroupId: group.id });

      const feed = await asOwner.issues({ issueId: issue.id }).feed.get({ query: {} });
      const entry = feed.data!.items.find((i) => i.action === 'assignee_group');
      expect(entry).toBeDefined();
      expect(entry!.payload.to).toMatchObject({ value: 'Pharmacy', id: group.id });
    });
  });

  describe('notifications', () => {
    it('notifies every group member except the actor when an issue is assigned to the group', async () => {
      const { asOwner, ownerId, columnId } = await setup();
      const a = await addMember(asOwner);
      const b = await addMember(asOwner);
      const outsider = await addMember(asOwner);
      const scope = asOwner.projects({ projectKey: 'MKT' });
      const group = (
        await scope.groups.post({ name: 'G', memberIds: [a.userId, b.userId, ownerId] })
      ).data!;
      const issue = (await scope.issues.post({ columnId, title: 'Task' })).data!;

      await asOwner.issues({ issueId: issue.id }).patch({ assigneeGroupId: group.id });

      for (const m of [a, b]) {
        const items = (await m.api.notifications.get({ query: {} })).data!.items;
        expect(items.map((i) => i.type)).toEqual(['assigned']);
        expect(items[0].issueId).toBe(issue.id);
      }
      expect((await asOwner.notifications.get({ query: {} })).data!.items).toEqual([]);
      expect((await outsider.api.notifications.get({ query: {} })).data!.items).toEqual([]);
    });

    it('notifies the group on create, and a member who is also the person assignee only once', async () => {
      const { asOwner, columnId } = await setup();
      const a = await addMember(asOwner);
      const b = await addMember(asOwner);
      const scope = asOwner.projects({ projectKey: 'MKT' });
      const group = (await scope.groups.post({ name: 'G', memberIds: [a.userId, b.userId] })).data!;

      await scope.issues.post({
        columnId,
        title: 'Task',
        assigneeUserId: a.userId,
        assigneeGroupId: group.id,
      });

      expect((await a.api.notifications.get({ query: {} })).data!.items).toHaveLength(1);
      expect((await b.api.notifications.get({ query: {} })).data!.items).toHaveLength(1);
    });
  });
});
