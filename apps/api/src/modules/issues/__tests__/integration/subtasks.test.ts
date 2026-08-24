import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Subtasks: an issue carries the id of the issue it hangs under (parentId), set on
// create or through an update. The hierarchy is one level deep and stays inside one
// project. An issue's parent and its subtasks come back with the issue read
// (GET /issues/:issueId → `parent` / `subtasks`); deleting or archiving an issue
// that has subtasks says what happens to them (cascade / detach / reassign) or is
// rejected with a 409.

interface Setup {
  asOwner: Api;
  columnId: number;
  doneColumnId: number;
  canceledColumnId: number;
}

async function setupProject(): Promise<Setup> {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columns = view.data!.columns;
  const byState = (stateType: string) => columns.find((c) => c.stateType === stateType)!.id;
  return {
    asOwner,
    columnId: columns[0].id,
    doneColumnId: byState('completed'),
    canceledColumnId: byState('canceled'),
  };
}

function createIssue(client: Api, columnId: number, title = 'Task') {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
}

// A parent with one subtask attached, the shape most of the tests start from.
async function parentWithSubtask(client: Api, columnId: number) {
  const parent = (await createIssue(client, columnId, 'Parent')).data!;
  const subtask = (
    await client.projects({ projectKey: 'MKT' }).issues.post({
      columnId,
      title: 'Subtask',
      parentId: parent.id,
    })
  ).data!;
  return { parent, subtask };
}

function createSubtask(client: Api, columnId: number, parentId: number, title: string) {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title, parentId });
}

function setParent(client: Api, issueId: number, parentId: number | null) {
  return client.issues({ issueId }).patch({ parentId });
}

function move(client: Api, issueId: number, columnId: number) {
  return client.issues({ issueId }).patch({ columnId });
}

function setAutomations(client: Api, input: { completeParent: boolean; closeSubtasks: boolean }) {
  return client.projects({ projectKey: 'MKT' }).settings.subtasks.patch(input);
}

async function read(client: Api, issueId: number) {
  const res = await client.issues({ issueId }).get();
  return res.data!;
}

// An issue of a second project, which no issue of the first one may hang under.
async function foreignIssue(client: Api) {
  await client.projects.post({ key: 'OPS', name: 'Operations' });
  const view = await client.projects({ projectKey: 'OPS' }).get();
  const res = await client
    .projects({ projectKey: 'OPS' })
    .issues.post({ columnId: view.data!.columns[0].id, title: 'Elsewhere' });
  return res.data!;
}

describe('subtasks', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('attach', () => {
    it('creates an issue under a parent and shows the pair from both sides', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);

      expect(subtask.parentId).toBe(parent.id);
      expect(await read(asOwner, parent.id)).toMatchObject({
        parent: null,
        subtasks: [{ id: subtask.id, identifier: subtask.identifier, title: 'Subtask' }],
      });
      expect(await read(asOwner, subtask.id)).toMatchObject({
        parent: { id: parent.id, identifier: parent.identifier, title: 'Parent' },
        subtasks: [],
      });
    });

    it('attaches an existing issue through an update', async () => {
      const { asOwner, columnId } = await setupProject();
      const parent = (await createIssue(asOwner, columnId, 'Parent')).data!;
      const other = (await createIssue(asOwner, columnId, 'Other')).data!;

      const res = await setParent(asOwner, other.id, parent.id);
      expect(res.status).toBe(200);
      expect(res.data!.parentId).toBe(parent.id);
    });

    it('detaches a subtask when its parent is cleared', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);

      const res = await setParent(asOwner, subtask.id, null);
      expect(res.status).toBe(200);
      expect(res.data!.parentId).toBe(null);
      expect((await read(asOwner, parent.id)).subtasks).toEqual([]);
    });

    it('rejects an issue as its own parent with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await setParent(asOwner, issue.id, issue.id);
      expect(res.status).toBe(400);
    });

    it('rejects a parent in another project with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const outside = await foreignIssue(asOwner);

      const res = await setParent(asOwner, issue.id, outside.id);
      expect(res.status).toBe(400);
    });

    it('rejects a missing parent with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await setParent(asOwner, issue.id, 999999);
      expect(res.status).toBe(400);
    });

    it('rejects a subtask as a parent with 400 (one level deep)', async () => {
      const { asOwner, columnId } = await setupProject();
      const { subtask } = await parentWithSubtask(asOwner, columnId);
      const other = (await createIssue(asOwner, columnId, 'Other')).data!;

      const res = await setParent(asOwner, other.id, subtask.id);
      expect(res.status).toBe(400);
    });

    it('rejects making an issue that has subtasks a subtask with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent } = await parentWithSubtask(asOwner, columnId);
      const other = (await createIssue(asOwner, columnId, 'Other')).data!;

      const res = await setParent(asOwner, parent.id, other.id);
      expect(res.status).toBe(400);
    });

    it('records the change on the subtask and on both parents', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);
      const next = (await createIssue(asOwner, columnId, 'Next parent')).data!;

      await setParent(asOwner, subtask.id, next.id);

      const subtaskFeed = await asOwner.issues({ issueId: subtask.id }).feed.get({ query: {} });
      expect(subtaskFeed.data!.items).toContainEqual(
        expect.objectContaining({
          action: 'parent',
          payload: {
            from: { value: parent.identifier, id: parent.id },
            to: { value: next.identifier, id: next.id },
          },
        }),
      );
      const oldParentFeed = await asOwner.issues({ issueId: parent.id }).feed.get({ query: {} });
      expect(oldParentFeed.data!.items).toContainEqual(
        expect.objectContaining({
          action: 'subtask_remove',
          payload: { from: { value: subtask.identifier, id: subtask.id } },
        }),
      );
      const newParentFeed = await asOwner.issues({ issueId: next.id }).feed.get({ query: {} });
      expect(newParentFeed.data!.items).toContainEqual(
        expect.objectContaining({
          action: 'subtask_add',
          payload: { to: { value: subtask.identifier, id: subtask.id } },
        }),
      );
    });

    it('lists a parent’s subtasks by the parentId filter', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);
      await createIssue(asOwner, columnId, 'Unrelated');

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.get({ query: { parentId: parent.id } });
      expect(res.data).toMatchObject([{ id: subtask.id, parentId: parent.id }]);
    });
  });

  describe('board', () => {
    it('counts an archived subtask on its parent', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);
      await asOwner.issues({ issueId: subtask.id }).archive.post();

      const board = await asOwner.projects({ projectKey: 'MKT' }).issues.board.get();
      expect(board.data!.issues).toContainEqual(
        expect.objectContaining({ id: parent.id, subtaskCount: 1 }),
      );
    });
  });

  describe('delete', () => {
    it('deletes the subtasks with the parent on cascade', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);

      const res = await asOwner.issues({ issueId: parent.id }).delete(undefined, {
        query: { subtasks: 'cascade' },
      });
      expect(res.status).toBe(204);
      expect((await asOwner.issues({ issueId: subtask.id }).get()).status).toBe(404);
    });

    it('keeps the subtasks as ordinary issues on detach', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);

      const res = await asOwner.issues({ issueId: parent.id }).delete(undefined, {
        query: { subtasks: 'detach' },
      });
      expect(res.status).toBe(204);
      expect(await read(asOwner, subtask.id)).toMatchObject({ parentId: null, parent: null });
    });

    it('moves the subtasks to the new parent on reassign', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);
      const next = (await createIssue(asOwner, columnId, 'Next parent')).data!;

      const res = await asOwner.issues({ issueId: parent.id }).delete(undefined, {
        query: { subtasks: 'reassign', newParentId: next.id },
      });
      expect(res.status).toBe(204);
      expect((await read(asOwner, subtask.id)).parentId).toBe(next.id);
    });

    it('rejects a delete that does not say what happens to the subtasks with 409', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);

      const res = await asOwner.issues({ issueId: parent.id }).delete();
      expect(res.status).toBe(409);
      expect((await asOwner.issues({ issueId: subtask.id }).get()).status).toBe(200);
      expect((await asOwner.issues({ issueId: parent.id }).get()).status).toBe(200);
    });

    it('rejects reassigning the subtasks to the issue being deleted with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent } = await parentWithSubtask(asOwner, columnId);

      const res = await asOwner.issues({ issueId: parent.id }).delete(undefined, {
        query: { subtasks: 'reassign', newParentId: parent.id },
      });
      expect(res.status).toBe(400);
      expect((await asOwner.issues({ issueId: parent.id }).get()).status).toBe(200);
    });

    it('deletes an issue without subtasks with no choice to make', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner.issues({ issueId: issue.id }).delete();
      expect(res.status).toBe(204);
    });
  });

  describe('archive', () => {
    it('archives the subtasks with the parent on cascade', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);

      const res = await asOwner.issues({ issueId: parent.id }).archive.post({
        subtasks: 'cascade',
      });
      expect(res.status).toBe(200);
      expect((await read(asOwner, subtask.id)).archivedAt).not.toBe(null);
    });

    it('keeps the subtasks on the board on detach', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);

      const res = await asOwner.issues({ issueId: parent.id }).archive.post({
        subtasks: 'detach',
      });
      expect(res.status).toBe(200);
      expect(await read(asOwner, subtask.id)).toMatchObject({ parentId: null, archivedAt: null });
    });

    it('rejects an archive that does not say what happens to the subtasks with 409', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent } = await parentWithSubtask(asOwner, columnId);

      const res = await asOwner.issues({ issueId: parent.id }).archive.post();
      expect(res.status).toBe(409);
      expect((await read(asOwner, parent.id)).archivedAt).toBe(null);
    });

    it('brings the subtasks back when the parent is restored', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);
      await asOwner.issues({ issueId: parent.id }).archive.post({ subtasks: 'cascade' });

      const res = await asOwner.issues({ issueId: parent.id }).restore.post();
      expect(res.status).toBe(200);
      expect(await read(asOwner, subtask.id)).toMatchObject({ archivedAt: null });
    });

    it('archives an issue without subtasks with no choice to make', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner.issues({ issueId: issue.id }).archive.post();
      expect(res.status).toBe(200);
    });
  });

  describe('bulk', () => {
    it('rejects a bulk archive that leaves the subtasks unsaid with 409', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent } = await parentWithSubtask(asOwner, columnId);

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.archive.post({ ids: [parent.id] });
      expect(res.status).toBe(409);
      expect((await read(asOwner, parent.id)).archivedAt).toBe(null);
    });

    it('leaves the subtasks of another project’s issue alone', async () => {
      const { asOwner, columnId } = await setupProject();
      await createIssue(asOwner, columnId, 'Anything');
      const outside = await foreignIssue(asOwner);
      const outsideSubtask = (
        await asOwner.projects({ projectKey: 'OPS' }).issues.post({
          columnId: outside.columnId,
          title: 'Outside subtask',
          parentId: outside.id,
        })
      ).data!;

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.delete.post({ ids: [outside.id], subtasks: 'cascade' });
      expect(res.status).toBe(200);
      expect((await asOwner.issues({ issueId: outsideSubtask.id }).get()).status).toBe(200);
      expect((await read(asOwner, outsideSubtask.id)).parentId).toBe(outside.id);
    });

    it('rejects reassigning to an issue the same request removes with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);
      const alsoRemoved = (await createIssue(asOwner, columnId, 'Also removed')).data!;

      const res = await asOwner.projects({ projectKey: 'MKT' }).issues.bulk.delete.post({
        ids: [parent.id, alsoRemoved.id],
        subtasks: 'reassign',
        newParentId: alsoRemoved.id,
      });
      expect(res.status).toBe(400);
      expect((await read(asOwner, subtask.id)).parentId).toBe(parent.id);
      expect((await asOwner.issues({ issueId: parent.id }).get()).status).toBe(200);
      expect((await asOwner.issues({ issueId: alsoRemoved.id }).get()).status).toBe(200);
    });

    it('detaches the subtasks of a bulk delete', async () => {
      const { asOwner, columnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.delete.post({ ids: [parent.id], subtasks: 'detach' });
      expect(res.status).toBe(200);
      expect(await read(asOwner, subtask.id)).toMatchObject({ parentId: null });
    });
  });

  describe('close automations', () => {
    it('leaves the hierarchy alone while both automations are off', async () => {
      const { asOwner, columnId, doneColumnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);

      await move(asOwner, subtask.id, doneColumnId);
      expect((await read(asOwner, parent.id)).columnId).toBe(columnId);

      await move(asOwner, parent.id, doneColumnId);
      expect((await read(asOwner, subtask.id)).columnId).toBe(doneColumnId);
      await move(asOwner, subtask.id, columnId);
      expect((await read(asOwner, subtask.id)).columnId).toBe(columnId);
    });

    it('closes the parent in the column its last subtask landed in', async () => {
      const { asOwner, columnId, doneColumnId, canceledColumnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);
      const second = (await createSubtask(asOwner, columnId, parent.id, 'Second')).data!;
      await setAutomations(asOwner, { completeParent: true, closeSubtasks: false });

      await move(asOwner, subtask.id, canceledColumnId);
      expect((await read(asOwner, parent.id)).columnId).toBe(columnId);

      await move(asOwner, second.id, doneColumnId);
      expect((await read(asOwner, parent.id)).columnId).toBe(doneColumnId);
    });

    it('holds the parent open while a subtask is still open', async () => {
      const { asOwner, columnId, doneColumnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);
      await createSubtask(asOwner, columnId, parent.id, 'Second');
      await setAutomations(asOwner, { completeParent: true, closeSubtasks: false });

      await move(asOwner, subtask.id, doneColumnId);
      expect((await read(asOwner, parent.id)).columnId).toBe(columnId);
    });

    it('ignores an archived subtask when closing the parent', async () => {
      const { asOwner, columnId, doneColumnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);
      const archived = (await createSubtask(asOwner, columnId, parent.id, 'Archived')).data!;
      await asOwner.issues({ issueId: archived.id }).archive.post();
      await setAutomations(asOwner, { completeParent: true, closeSubtasks: false });

      await move(asOwner, subtask.id, doneColumnId);
      expect((await read(asOwner, parent.id)).columnId).toBe(doneColumnId);
    });

    it('closes the open subtasks in the column the parent was closed in', async () => {
      const { asOwner, columnId, doneColumnId, canceledColumnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);
      const alreadyClosed = (await createSubtask(asOwner, columnId, parent.id, 'Closed')).data!;
      await move(asOwner, alreadyClosed.id, canceledColumnId);
      await setAutomations(asOwner, { completeParent: false, closeSubtasks: true });

      await move(asOwner, parent.id, doneColumnId);
      expect((await read(asOwner, subtask.id)).columnId).toBe(doneColumnId);
      expect((await read(asOwner, alreadyClosed.id)).columnId).toBe(canceledColumnId);
    });

    it('settles with both automations on', async () => {
      const { asOwner, columnId, doneColumnId } = await setupProject();
      const { parent, subtask } = await parentWithSubtask(asOwner, columnId);
      await setAutomations(asOwner, { completeParent: true, closeSubtasks: true });

      const res = await move(asOwner, parent.id, doneColumnId);
      expect(res.status).toBe(200);
      expect((await read(asOwner, parent.id)).columnId).toBe(doneColumnId);
      expect((await read(asOwner, subtask.id)).columnId).toBe(doneColumnId);
    });
  });
});
