import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { addProjectMember } from '#tests/helpers/members';
import { resetDb } from '#tests/helpers/db';

// A column's auto-assignee: the member every issue entering it is assigned to,
// replacing whoever held it. Applied by the store, so it covers every move — a
// board drag, an issue patch, the bulk update the board's multi-select uses, and
// an issue created in the column.

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner, ownerId: owner.userId };
}

async function columnByName(client: Api, name: string) {
  const view = await client.projects({ projectKey: 'MKT' }).get();
  return view.data!.columns.find((c) => c.name === name)!;
}

// A second member of the project, as their user id.
async function addMember(asOwner: Api, ownerId: string) {
  await addProjectMember(asOwner, 'MKT');
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  return view.data!.assignees.find((a) => a.kind === 'member' && a.userId !== ownerId)!.userId;
}

function setAutoAssignee(client: Api, columnId: number, autoAssignUserId: string | null) {
  return client.projects({ projectKey: 'MKT' }).columns({ columnId }).patch({ autoAssignUserId });
}

function createIssue(client: Api, columnId: number, title = 'Task') {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
}

describe('column auto-assignee', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('configuration', () => {
    it('defaults to nobody', async () => {
      const { asOwner } = await setupProject();

      expect(await columnByName(asOwner, 'In Progress')).toMatchObject({
        autoAssignUserId: null,
      });
    });

    it('sets and clears the auto-assignee', async () => {
      const { asOwner, ownerId } = await setupProject();
      const column = await columnByName(asOwner, 'In Progress');

      const set = await setAutoAssignee(asOwner, column.id, ownerId);
      expect(set.status).toBe(200);
      expect(set.data).toMatchObject({ autoAssignUserId: ownerId });

      const cleared = await setAutoAssignee(asOwner, column.id, null);
      expect(cleared.status).toBe(200);
      expect(cleared.data).toMatchObject({ autoAssignUserId: null });
    });

    it('accepts an auto-assignee on create', async () => {
      const { asOwner, ownerId } = await setupProject();

      const created = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns.post({ name: 'Review', stateType: 'started', autoAssignUserId: ownerId });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ autoAssignUserId: ownerId });
    });

    it('rejects a user who is not a project member', async () => {
      const { asOwner } = await setupProject();
      const outsider = await signUpTestUser();
      const column = await columnByName(asOwner, 'In Progress');

      expect((await setAutoAssignee(asOwner, column.id, outsider.userId)).status).toBe(400);
      expect(
        (
          await asOwner
            .projects({ projectKey: 'MKT' })
            .columns.post({ name: 'Review', stateType: 'started', autoAssignUserId: 'nobody' })
        ).status,
      ).toBe(400);
    });

    // Left in place it would keep assigning issues to a non-member, which the same
    // assignment sent as a patch is refused for.
    it('is cleared when the member leaves the project', async () => {
      const { asOwner, ownerId } = await setupProject();
      const memberId = await addMember(asOwner, ownerId);
      const column = await columnByName(asOwner, 'In Progress');
      await setAutoAssignee(asOwner, column.id, memberId);

      const removed = await asOwner
        .projects({ projectKey: 'MKT' })
        .members({ userId: memberId })
        .delete();
      expect(removed.status).toBe(204);

      expect(await columnByName(asOwner, 'In Progress')).toMatchObject({
        autoAssignUserId: null,
      });
    });

    // The copy starts with only its owner as a member, so an auto-assignee carried
    // over would not be one there.
    it('is not carried over by a project copy', async () => {
      const { asOwner, ownerId } = await setupProject();
      const column = await columnByName(asOwner, 'In Progress');
      await setAutoAssignee(asOwner, column.id, ownerId);

      const copy = await asOwner
        .projects({ projectKey: 'MKT' })
        .copy.post({ key: 'COPY', name: 'Copy' });
      expect(copy.status).toBe(201);

      const view = await asOwner.projects({ projectKey: 'COPY' }).get();
      expect(view.data!.columns.find((c) => c.name === 'In Progress')).toMatchObject({
        autoAssignUserId: null,
      });
    });
  });

  describe('creating an issue', () => {
    it('assigns an issue created in the column', async () => {
      const { asOwner, ownerId } = await setupProject();
      const memberId = await addMember(asOwner, ownerId);
      const progress = await columnByName(asOwner, 'In Progress');
      await setAutoAssignee(asOwner, progress.id, memberId);

      const created = await createIssue(asOwner, progress.id);
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ assigneeUserId: memberId });
    });

    it('keeps an assignee sent with the create', async () => {
      const { asOwner, ownerId } = await setupProject();
      const memberId = await addMember(asOwner, ownerId);
      const progress = await columnByName(asOwner, 'In Progress');
      await setAutoAssignee(asOwner, progress.id, memberId);

      const created = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: progress.id, title: 'Task', assigneeUserId: ownerId });
      expect(created.data).toMatchObject({ assigneeUserId: ownerId });
    });
  });

  describe('moving an issue', () => {
    it('assigns the issue on the way in, replacing its assignee', async () => {
      const { asOwner, ownerId } = await setupProject();
      const memberId = await addMember(asOwner, ownerId);
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      await setAutoAssignee(asOwner, progress.id, memberId);
      const created = await createIssue(asOwner, todo.id);
      await asOwner.issues({ issueId: created.data!.id }).patch({ assigneeUserId: ownerId });

      const moved = await asOwner
        .issues({ issueId: created.data!.id })
        .patch({ columnId: progress.id });
      expect(moved.status).toBe(200);
      expect(moved.data).toMatchObject({ columnId: progress.id, assigneeUserId: memberId });
    });

    it('leaves the assignee alone when the column assigns nobody', async () => {
      const { asOwner, ownerId } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      const created = await createIssue(asOwner, todo.id);
      await asOwner.issues({ issueId: created.data!.id }).patch({ assigneeUserId: ownerId });

      const moved = await asOwner
        .issues({ issueId: created.data!.id })
        .patch({ columnId: progress.id });
      expect(moved.data).toMatchObject({ assigneeUserId: ownerId });
    });

    it('keeps an assignee sent with the same move', async () => {
      const { asOwner, ownerId } = await setupProject();
      const memberId = await addMember(asOwner, ownerId);
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      await setAutoAssignee(asOwner, progress.id, memberId);
      const created = await createIssue(asOwner, todo.id);

      const moved = await asOwner
        .issues({ issueId: created.data!.id })
        .patch({ columnId: progress.id, assigneeUserId: ownerId });
      expect(moved.data).toMatchObject({ assigneeUserId: ownerId });
    });

    it('does not reassign an issue already in the column', async () => {
      const { asOwner, ownerId } = await setupProject();
      const memberId = await addMember(asOwner, ownerId);
      const progress = await columnByName(asOwner, 'In Progress');
      const created = await createIssue(asOwner, progress.id);
      await setAutoAssignee(asOwner, progress.id, memberId);

      const saved = await asOwner
        .issues({ issueId: created.data!.id })
        .patch({ columnId: progress.id, title: 'Renamed' });
      expect(saved.data).toMatchObject({ title: 'Renamed', assigneeUserId: null });
    });

    it('applies to a bulk move', async () => {
      const { asOwner, ownerId } = await setupProject();
      const memberId = await addMember(asOwner, ownerId);
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      await setAutoAssignee(asOwner, progress.id, memberId);
      const first = (await createIssue(asOwner, todo.id, 'First')).data!;
      const second = (await createIssue(asOwner, todo.id, 'Second')).data!;

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.patch({ ids: [first.id, second.id], patch: { columnId: progress.id } });
      expect(res.status).toBe(200);

      for (const id of [first.id, second.id])
        expect((await asOwner.issues({ issueId: id }).get()).data).toMatchObject({
          columnId: progress.id,
          assigneeUserId: memberId,
        });
    });
  });
});
