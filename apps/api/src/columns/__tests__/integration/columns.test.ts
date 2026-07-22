import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// Columns (kanban states). There is no GET /columns route — a column is read back
// through the project view (GET /projects/:projectKey), whose `columns` field is
// listColumns(): every column ordered by state type (backlog → unstarted →
// started → completed → canceled), then by position within a type. createProject
// seeds five default columns, one per state type.

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

// The project's columns in work-items order (state type, then position).
async function columnsOf(client: Api, projectKey = 'MKT') {
  const view = await client.projects({ projectKey }).get();
  return view.data!.columns;
}

async function columnByName(client: Api, name: string, projectKey = 'MKT') {
  const cols = await columnsOf(client, projectKey);
  return cols.find((c) => c.name === name)!;
}

function createIssue(client: Api, columnId: number, title = 'Task') {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
}

describe('columns', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create', () => {
    it('creates a column with a default color and lists it in the view', async () => {
      const { asOwner } = await setupProject();

      const created = await asOwner.projects({ projectKey: 'MKT' }).columns.post({
        name: 'Review',
        stateType: 'started',
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        name: 'Review',
        stateType: 'started',
        color: '#6b7280',
      });
      expect(typeof created.data?.id).toBe('number');

      const cols = await columnsOf(asOwner);
      expect(cols.map((c) => c.name)).toContain('Review');
    });

    it('stores a provided color', async () => {
      const { asOwner } = await setupProject();
      const created = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns.post({ name: 'Review', stateType: 'started', color: '#123456' });
      expect(created.data).toMatchObject({ color: '#123456' });
    });

    it('rejects an empty name', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns.post({ name: '', stateType: 'started' });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown state type', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.projects({ projectKey: 'MKT' }).columns.post({
        name: 'Weird',
        stateType: 'nonsense' as unknown as 'started',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('reorder', () => {
    it('reorders columns within a state type', async () => {
      const { asOwner } = await setupProject();
      const inProgress = await columnByName(asOwner, 'In Progress');
      const review = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          .columns.post({ name: 'Review', stateType: 'started' })
      ).data!;

      // Before: the two started columns list as [In Progress, Review] (by
      // position). Reorder to put Review first.
      const reordered = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns.reorder.put({ orderedIds: [review.id, inProgress.id] });
      expect(reordered.status).toBe(200);

      const started = reordered.data!.filter((c) => c.stateType === 'started');
      expect(started.map((c) => c.name)).toEqual(['Review', 'In Progress']);
    });

    it('ignores ids that belong to another project', async () => {
      const { asOwner } = await setupProject();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const opsBefore = await columnsOf(asOwner, 'OPS');
      const foreignId = opsBefore[0].id;

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns.reorder.put({ orderedIds: [foreignId] });
      expect(res.status).toBe(200);
      // The reorder must not touch OPS: its columns keep their order and positions.
      const opsAfter = await columnsOf(asOwner, 'OPS');
      expect(opsAfter.map((c) => c.id)).toEqual(opsBefore.map((c) => c.id));
      expect(opsAfter.map((c) => c.position)).toEqual(opsBefore.map((c) => c.position));
    });

    it('rejects an empty ordered list', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns.reorder.put({ orderedIds: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('update', () => {
    it('updates the name', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');

      const patched = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: todo.id })
        .patch({ name: 'To Do' });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ name: 'To Do' });

      const cols = await columnsOf(asOwner);
      expect(cols.find((c) => c.id === todo.id)?.name).toBe('To Do');
    });

    it('moves a column to a different state type', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');

      const patched = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: todo.id })
        .patch({ stateType: 'started' });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ stateType: 'started' });

      // The view groups by state type, so the former Todo now lists among the
      // started columns.
      const started = (await columnsOf(asOwner)).filter((c) => c.stateType === 'started');
      expect(started.map((c) => c.id)).toContain(todo.id);
    });

    it('returns 404 for a missing column', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: 999999 })
        .patch({ name: 'Nope' });
      expect(res.status).toBe(404);
    });

    it('rejects an empty name', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: todo.id })
        .patch({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown state type', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: todo.id })
        .patch({ stateType: 'nonsense' as unknown as 'started' });
      expect(res.status).toBe(400);
    });
  });

  describe('delete', () => {
    it("moves the column's issues to the target, then drops the column", async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const inProgress = await columnByName(asOwner, 'In Progress');
      const issue = (await createIssue(asOwner, todo.id)).data!;

      const del = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: todo.id })
        .delete({ mode: 'move', targetColumnId: inProgress.id });
      expect(del.status).toBe(204);

      // Column gone from the view; the issue survived, now in the target column.
      const cols = await columnsOf(asOwner);
      expect(cols.map((c) => c.id)).not.toContain(todo.id);
      const moved = await asOwner.issues({ issueId: issue.id }).get();
      expect(moved.data?.columnId).toBe(inProgress.id);
    });

    it('removes the column and its issues in delete mode', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const issue = (await createIssue(asOwner, todo.id)).data!;

      const del = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: todo.id })
        .delete({ mode: 'delete' });
      expect(del.status).toBe(204);

      const cols = await columnsOf(asOwner);
      expect(cols.map((c) => c.id)).not.toContain(todo.id);
      const gone = await asOwner.issues({ issueId: issue.id }).get();
      expect(gone.status).toBe(404);
    });

    it('rejects deleting a backlog column', async () => {
      const { asOwner } = await setupProject();
      const backlog = await columnByName(asOwner, 'Backlog');
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: backlog.id })
        .delete({ mode: 'delete' });
      expect(res.status).toBe(400);
    });

    it('rejects a move whose target is in another project', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = (await columnsOf(asOwner, 'OPS'))[0];

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: todo.id })
        .delete({ mode: 'move', targetColumnId: foreign.id });
      expect(res.status).toBe(400);
    });

    it('rejects a move whose target is the column itself', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: todo.id })
        .delete({ mode: 'move', targetColumnId: todo.id });
      expect(res.status).toBe(400);
    });

    it('returns 404 for a missing column', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: 999999 })
        .delete({ mode: 'delete' });
      expect(res.status).toBe(404);
    });

    it('rejects an invalid delete body', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      // mode "move" without a targetColumnId does not match either union branch.
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: todo.id })
        .delete({ mode: 'move' } as unknown as { mode: 'delete' });
      expect(res.status).toBe(400);
    });
  });

  // A column is addressed as /projects/:projectKey/columns/:columnId. The
  // permission guard runs on :projectKey, so the store must also scope the column
  // to that project — otherwise a member of one project could edit or delete a
  // column of another project by passing its id.
  describe('cross-project isolation', () => {
    it('does not patch a column that belongs to another project', async () => {
      const { asOwner } = await setupProject();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = await columnByName(asOwner, 'Todo', 'OPS');

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: foreign.id })
        .patch({ name: 'Hijacked' });
      expect(res.status).toBe(404);

      const opsTodo = await columnByName(asOwner, 'Todo', 'OPS');
      expect(opsTodo.name).toBe('Todo');
    });

    it('does not delete a column that belongs to another project', async () => {
      const { asOwner } = await setupProject();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = await columnByName(asOwner, 'Todo', 'OPS');

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: foreign.id })
        .delete({ mode: 'delete' });
      expect(res.status).toBe(404);

      const opsCols = await columnsOf(asOwner, 'OPS');
      expect(opsCols.map((c) => c.id)).toContain(foreign.id);
    });
  });

  describe('access', () => {
    it('returns 404 for an unknown project', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'NOPE' })
        .columns.post({ name: 'X', stateType: 'started' });
      expect(res.status).toBe(404);
    });

    it('denies a non-member on every column route', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const outsider = authedApi((await signUpTestUser()).cookie);
      const scope = outsider.projects({ projectKey: 'MKT' });

      // Guard-thrown 403 is not in Treaty's inferred error-status union, so assert
      // the top-level HTTP status rather than error.status.
      expect((await scope.columns.post({ name: 'X', stateType: 'started' })).status).toBe(403);
      expect((await scope.columns.reorder.put({ orderedIds: [todo.id] })).status).toBe(403);
      expect((await scope.columns({ columnId: todo.id }).patch({ name: 'X' })).status).toBe(403);
      expect((await scope.columns({ columnId: todo.id }).delete({ mode: 'delete' })).status).toBe(
        403,
      );
    });
  });
});
