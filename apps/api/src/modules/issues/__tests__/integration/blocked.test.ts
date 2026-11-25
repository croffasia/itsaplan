import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The blocked column (project_column.blocked). A person moves an issue there with a
// reason, and it stays until someone moves it out. An issue an open issue blocks is
// moved there without one, and moved back to the column it came from once no open
// issue blocks it.

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

async function columnByName(client: Api, name: string) {
  const view = await client.projects({ projectKey: 'MKT' }).get();
  return view.data!.columns.find((c) => c.name === name)!;
}

async function addBlockedColumn(client: Api) {
  const res = await client
    .projects({ projectKey: 'MKT' })
    .columns.post({ name: 'Blocked', stateType: 'started', blocked: true });
  return res.data!;
}

async function createIssue(client: Api, columnId: number, title = 'Task') {
  const res = await client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
  return res.data!;
}

async function issueOf(client: Api, issueId: number) {
  const res = await client.issues({ issueId }).get();
  return res.data!;
}

function block(client: Api, blockerId: number, blockedId: number) {
  return client.issues({ issueId: blockedId }).links.post({
    targetIssueId: blockerId,
    kind: 'blocked_by',
  });
}

describe('blocked column', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('configuration', () => {
    it('keeps one blocked column per project', async () => {
      const { asOwner } = await setupProject();
      const first = await addBlockedColumn(asOwner);
      const second = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns.post({ name: 'On hold', stateType: 'started', blocked: true });
      expect(second.status).toBe(201);

      const view = await asOwner.projects({ projectKey: 'MKT' }).get();
      const blocked = view.data!.columns.filter((c) => c.blocked).map((c) => c.id);
      expect(blocked).toEqual([second.data!.id]);
      expect(blocked).not.toContain(first.id);
    });

    it('refuses a backlog or closed state type', async () => {
      const { asOwner } = await setupProject();
      for (const name of ['Backlog', 'Done', 'Canceled']) {
        const column = await columnByName(asOwner, name);
        const res = await asOwner
          .projects({ projectKey: 'MKT' })
          .columns({ columnId: column.id })
          .patch({ blocked: true });
        expect(res.status).toBe(400);
      }

      const blocked = await addBlockedColumn(asOwner);
      const retyped = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: blocked.id })
        .patch({ stateType: 'completed' });
      expect(retyped.status).toBe(400);
    });
  });

  describe('manual block', () => {
    it('requires a reason and records where the issue came from', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const blocked = await addBlockedColumn(asOwner);
      const task = await createIssue(asOwner, todo.id);

      const missing = await asOwner.issues({ issueId: task.id }).patch({ columnId: blocked.id });
      expect(missing.status).toBe(400);
      expect(missing.error?.value).toMatchObject({ code: 'blocked_reason_required' });

      const blank = await asOwner
        .issues({ issueId: task.id })
        .patch({ columnId: blocked.id, blockedReason: '   ' });
      expect(blank.status).toBe(400);

      const res = await asOwner
        .issues({ issueId: task.id })
        .patch({ columnId: blocked.id, blockedReason: ' Waiting for the vendor ' });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        columnId: blocked.id,
        blockedReason: 'Waiting for the vendor',
        blockedFromColumnId: todo.id,
      });
    });

    it('requires a reason to create an issue in the column', async () => {
      const { asOwner } = await setupProject();
      const blocked = await addBlockedColumn(asOwner);
      const issues = asOwner.projects({ projectKey: 'MKT' }).issues;

      const missing = await issues.post({ columnId: blocked.id, title: 'Task' });
      expect(missing.status).toBe(400);

      const res = await issues.post({ columnId: blocked.id, title: 'Task', blockedReason: 'Waiting' });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ blockedReason: 'Waiting', blockedFromColumnId: null });
    });

    it('clears the reason when the issue leaves the column', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const blocked = await addBlockedColumn(asOwner);
      const task = await createIssue(asOwner, todo.id);
      await asOwner
        .issues({ issueId: task.id })
        .patch({ columnId: blocked.id, blockedReason: 'Waiting' });

      const res = await asOwner.issues({ issueId: task.id }).patch({ columnId: todo.id });
      expect(res.data).toMatchObject({ blockedReason: null, blockedFromColumnId: null });
    });

    it('requires a reason in a bulk move', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const blocked = await addBlockedColumn(asOwner);
      const a = await createIssue(asOwner, todo.id, 'A');
      const b = await createIssue(asOwner, todo.id, 'B');
      const bulk = asOwner.projects({ projectKey: 'MKT' }).issues.bulk;

      const missing = await bulk.patch({ ids: [a.id, b.id], patch: { columnId: blocked.id } });
      expect(missing.status).toBe(400);
      expect((await issueOf(asOwner, a.id)).columnId).toBe(todo.id);

      const res = await bulk.patch({
        ids: [a.id, b.id],
        patch: { columnId: blocked.id, blockedReason: 'Waiting' },
      });
      expect(res.status).toBe(200);
      expect(await issueOf(asOwner, b.id)).toMatchObject({
        columnId: blocked.id,
        blockedReason: 'Waiting',
      });
    });

    it('stays blocked when its blocker closes', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const done = await columnByName(asOwner, 'Done');
      const blocked = await addBlockedColumn(asOwner);
      const blocker = await createIssue(asOwner, todo.id, 'Blocker');
      const task = await createIssue(asOwner, todo.id);
      await asOwner
        .issues({ issueId: task.id })
        .patch({ columnId: blocked.id, blockedReason: 'Waiting' });
      await block(asOwner, blocker.id, task.id);

      await asOwner.issues({ issueId: blocker.id }).patch({ columnId: done.id });
      expect((await issueOf(asOwner, task.id)).columnId).toBe(blocked.id);
    });
  });

  describe('blocked by links', () => {
    it('moves the issue in when blocked and back when its blocker closes', async () => {
      const { asOwner } = await setupProject();
      const progress = await columnByName(asOwner, 'In Progress');
      const done = await columnByName(asOwner, 'Done');
      const blocked = await addBlockedColumn(asOwner);
      const blocker = await createIssue(asOwner, progress.id, 'Blocker');
      const task = await createIssue(asOwner, progress.id);

      expect((await block(asOwner, blocker.id, task.id)).status).toBe(201);
      expect(await issueOf(asOwner, task.id)).toMatchObject({
        columnId: blocked.id,
        blockedReason: null,
        blockedFromColumnId: progress.id,
      });

      await asOwner.issues({ issueId: blocker.id }).patch({ columnId: done.id });
      expect(await issueOf(asOwner, task.id)).toMatchObject({
        columnId: progress.id,
        blockedFromColumnId: null,
      });

      // Reopening the blocker blocks the issue again.
      await asOwner.issues({ issueId: blocker.id }).patch({ columnId: progress.id });
      expect((await issueOf(asOwner, task.id)).columnId).toBe(blocked.id);
    });

    it('waits for every open blocker', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const done = await columnByName(asOwner, 'Done');
      const blocked = await addBlockedColumn(asOwner);
      const first = await createIssue(asOwner, todo.id, 'First');
      const second = await createIssue(asOwner, todo.id, 'Second');
      const task = await createIssue(asOwner, todo.id);
      await block(asOwner, first.id, task.id);
      await block(asOwner, second.id, task.id);

      await asOwner.issues({ issueId: first.id }).patch({ columnId: done.id });
      expect((await issueOf(asOwner, task.id)).columnId).toBe(blocked.id);

      await asOwner.issues({ issueId: second.id }).archive.post();
      expect((await issueOf(asOwner, task.id)).columnId).toBe(todo.id);
    });

    it('returns the issue when the link is removed', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const blocked = await addBlockedColumn(asOwner);
      const blocker = await createIssue(asOwner, todo.id, 'Blocker');
      const task = await createIssue(asOwner, todo.id);
      const link = await block(asOwner, blocker.id, task.id);
      expect((await issueOf(asOwner, task.id)).columnId).toBe(blocked.id);

      await asOwner.issues({ issueId: task.id }).links({ linkId: link.data!.id }).delete();
      expect((await issueOf(asOwner, task.id)).columnId).toBe(todo.id);
    });

    it('returns the issue when its blocker is deleted', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const blocked = await addBlockedColumn(asOwner);
      const blocker = await createIssue(asOwner, todo.id, 'Blocker');
      const task = await createIssue(asOwner, todo.id);
      await block(asOwner, blocker.id, task.id);
      expect((await issueOf(asOwner, task.id)).columnId).toBe(blocked.id);

      await asOwner.issues({ issueId: blocker.id }).delete();
      expect((await issueOf(asOwner, task.id)).columnId).toBe(todo.id);
    });

    it('leaves backlog, closed and closed-blocker issues alone', async () => {
      const { asOwner } = await setupProject();
      const backlog = await columnByName(asOwner, 'Backlog');
      const todo = await columnByName(asOwner, 'Todo');
      const done = await columnByName(asOwner, 'Done');
      await addBlockedColumn(asOwner);
      const openBlocker = await createIssue(asOwner, todo.id, 'Open');
      const closedBlocker = await createIssue(asOwner, done.id, 'Closed');
      const inBacklog = await createIssue(asOwner, backlog.id, 'Backlog');
      const finished = await createIssue(asOwner, done.id, 'Finished');
      const task = await createIssue(asOwner, todo.id);

      await block(asOwner, openBlocker.id, inBacklog.id);
      await block(asOwner, openBlocker.id, finished.id);
      await block(asOwner, closedBlocker.id, task.id);
      expect((await issueOf(asOwner, inBacklog.id)).columnId).toBe(backlog.id);
      expect((await issueOf(asOwner, finished.id)).columnId).toBe(done.id);
      expect((await issueOf(asOwner, task.id)).columnId).toBe(todo.id);
    });

    it('does nothing without a blocked column', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const blocker = await createIssue(asOwner, todo.id, 'Blocker');
      const task = await createIssue(asOwner, todo.id);

      await block(asOwner, blocker.id, task.id);
      expect((await issueOf(asOwner, task.id)).columnId).toBe(todo.id);
    });

    it('moves already blocked issues in when a column becomes the blocked column', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const blocker = await createIssue(asOwner, todo.id, 'Blocker');
      const task = await createIssue(asOwner, todo.id);
      await block(asOwner, blocker.id, task.id);

      const blocked = await addBlockedColumn(asOwner);
      expect(await issueOf(asOwner, task.id)).toMatchObject({
        columnId: blocked.id,
        blockedFromColumnId: todo.id,
      });
      expect((await issueOf(asOwner, blocker.id)).columnId).toBe(todo.id);
    });

    it('leaves an issue it did not move in where it is', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const parked = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns.post({ name: 'On hold', stateType: 'started' });
      const blocker = await createIssue(asOwner, todo.id, 'Blocker');
      const task = await createIssue(asOwner, parked.data!.id);
      await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: parked.data!.id })
        .patch({ blocked: true });

      const link = await block(asOwner, blocker.id, task.id);
      await asOwner.issues({ issueId: task.id }).links({ linkId: link.data!.id }).delete();
      expect((await issueOf(asOwner, task.id)).columnId).toBe(parked.data!.id);
    });
  });
});
