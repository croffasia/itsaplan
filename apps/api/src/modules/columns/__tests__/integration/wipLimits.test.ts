import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Work-in-progress limits on a column. wipLimit is how many issues the column
// should hold and wipMode decides what happens at that number: 'soft' is advisory
// (the board renders a warning, nothing is refused) and 'hard' rejects an issue
// entering a full column with 409 / wip_limit_exceeded.
//
// Enforcement lives in the store, so every write path is covered by it: creating
// an issue, updating one, and the bulk update the board's multi-select uses.

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

async function columnByName(client: Api, name: string) {
  const view = await client.projects({ projectKey: 'MKT' }).get();
  return view.data!.columns.find((c) => c.name === name)!;
}

function createIssue(client: Api, columnId: number, title = 'Task') {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
}

// Fills a column with `n` issues while it has no limit, so the fixture itself is
// never refused by the rule under test.
async function fill(client: Api, columnId: number, n: number) {
  const ids: number[] = [];
  for (let i = 0; i < n; i++) {
    const res = await createIssue(client, columnId, `Task ${i + 1}`);
    ids.push(res.data!.id);
  }
  return ids;
}

function setLimit(
  client: Api,
  columnId: number,
  wipLimit: number | null,
  wipMode?: 'soft' | 'hard',
) {
  return client
    .projects({ projectKey: 'MKT' })
    .columns({ columnId })
    .patch({ wipLimit, ...(wipMode ? { wipMode } : {}) });
}

describe('column WIP limits', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('configuration', () => {
    it('defaults to no limit in soft mode', async () => {
      const { asOwner } = await setupProject();

      const column = await columnByName(asOwner, 'In Progress');
      expect(column).toMatchObject({ wipLimit: null, wipMode: 'soft' });
    });

    it('sets and clears a limit', async () => {
      const { asOwner } = await setupProject();
      const column = await columnByName(asOwner, 'In Progress');

      const set = await setLimit(asOwner, column.id, 3, 'hard');
      expect(set.status).toBe(200);
      expect(set.data).toMatchObject({ wipLimit: 3, wipMode: 'hard' });

      const cleared = await setLimit(asOwner, column.id, null);
      expect(cleared.status).toBe(200);
      // Clearing the limit leaves the mode alone; it is only read when a limit is set.
      expect(cleared.data).toMatchObject({ wipLimit: null, wipMode: 'hard' });
    });

    it('accepts a limit on create', async () => {
      const { asOwner } = await setupProject();

      const created = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns.post({ name: 'Review', stateType: 'started', wipLimit: 2, wipMode: 'hard' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ wipLimit: 2, wipMode: 'hard' });
    });

    it('rejects a limit below one', async () => {
      const { asOwner } = await setupProject();
      const column = await columnByName(asOwner, 'In Progress');

      expect((await setLimit(asOwner, column.id, 0)).status).toBe(400);
      expect((await setLimit(asOwner, column.id, -1)).status).toBe(400);
    });

    it('rejects an unknown mode', async () => {
      const { asOwner } = await setupProject();
      const column = await columnByName(asOwner, 'In Progress');

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .columns({ columnId: column.id })
        // @ts-expect-error the schema allows only 'soft' and 'hard'
        .patch({ wipMode: 'blocking' });
      expect(res.status).toBe(400);
    });

    it('survives a project copy', async () => {
      const { asOwner } = await setupProject();
      const column = await columnByName(asOwner, 'In Progress');
      await setLimit(asOwner, column.id, 4, 'hard');

      const copy = await asOwner
        .projects({ projectKey: 'MKT' })
        .copy.post({ key: 'COPY', name: 'Copy' });
      expect(copy.status).toBe(201);

      const view = await asOwner.projects({ projectKey: 'COPY' }).get();
      const copied = view.data!.columns.find((c) => c.name === 'In Progress')!;
      expect(copied).toMatchObject({ wipLimit: 4, wipMode: 'hard' });
    });
  });

  describe('soft mode', () => {
    it('allows a move past the limit', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      await fill(asOwner, progress.id, 2);
      await setLimit(asOwner, progress.id, 2, 'soft');
      const spare = (await createIssue(asOwner, todo.id)).data!;

      const moved = await asOwner.issues({ issueId: spare.id }).patch({ columnId: progress.id });
      expect(moved.status).toBe(200);
      expect(moved.data?.columnId).toBe(progress.id);
    });

    it('allows creating an issue past the limit', async () => {
      const { asOwner } = await setupProject();
      const progress = await columnByName(asOwner, 'In Progress');
      await fill(asOwner, progress.id, 1);
      await setLimit(asOwner, progress.id, 1, 'soft');

      expect((await createIssue(asOwner, progress.id)).status).toBe(201);
    });
  });

  describe('hard mode', () => {
    it('refuses a move into a full column with a machine-readable code', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      await fill(asOwner, progress.id, 2);
      await setLimit(asOwner, progress.id, 2, 'hard');
      const spare = (await createIssue(asOwner, todo.id)).data!;

      const moved = await asOwner.issues({ issueId: spare.id }).patch({ columnId: progress.id });
      expect(moved.status).toBe(409);
      expect(moved.error?.value).toMatchObject({ code: 'wip_limit_exceeded' });
      expect((moved.error?.value as { error: string }).error).toContain('In Progress');

      // The refused move wrote nothing.
      const after = await asOwner.issues({ issueId: spare.id }).get();
      expect(after.data?.columnId).toBe(todo.id);
    });

    it('allows a move while the column is still under the limit', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      await fill(asOwner, progress.id, 1);
      await setLimit(asOwner, progress.id, 2, 'hard');
      const spare = (await createIssue(asOwner, todo.id)).data!;

      expect(
        (await asOwner.issues({ issueId: spare.id }).patch({ columnId: progress.id })).status,
      ).toBe(200);
    });

    it('refuses creating an issue in a full column', async () => {
      const { asOwner } = await setupProject();
      const progress = await columnByName(asOwner, 'In Progress');
      await fill(asOwner, progress.id, 1);
      await setLimit(asOwner, progress.id, 1, 'hard');

      const res = await createIssue(asOwner, progress.id);
      expect(res.status).toBe(409);
      expect(res.error?.value).toMatchObject({ code: 'wip_limit_exceeded' });
    });

    it('still allows editing an issue already in a full column', async () => {
      const { asOwner } = await setupProject();
      const progress = await columnByName(asOwner, 'In Progress');
      const [first] = await fill(asOwner, progress.id, 2);
      await setLimit(asOwner, progress.id, 2, 'hard');

      // A patch that does not move the issue is not an entry into the column.
      const renamed = await asOwner.issues({ issueId: first }).patch({ title: 'Renamed' });
      expect(renamed.status).toBe(200);

      // Nor is one that names the column the issue already sits in.
      const resaved = await asOwner.issues({ issueId: first }).patch({ columnId: progress.id });
      expect(resaved.status).toBe(200);
    });

    it('lets an over-capacity column drain but takes nothing new', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      const ids = await fill(asOwner, progress.id, 3);

      // Lowering the limit under the current count is allowed and keeps the issues.
      const lowered = await setLimit(asOwner, progress.id, 2, 'hard');
      expect(lowered.status).toBe(200);
      const spare = (await createIssue(asOwner, todo.id)).data!;
      expect(
        (await asOwner.issues({ issueId: spare.id }).patch({ columnId: progress.id })).status,
      ).toBe(409);

      // Moving one out leaves 2, still not under the limit of 2.
      await asOwner.issues({ issueId: ids[0] }).patch({ columnId: todo.id });
      expect(
        (await asOwner.issues({ issueId: spare.id }).patch({ columnId: progress.id })).status,
      ).toBe(409);

      // One more out leaves room for exactly one.
      await asOwner.issues({ issueId: ids[1] }).patch({ columnId: todo.id });
      expect(
        (await asOwner.issues({ issueId: spare.id }).patch({ columnId: progress.id })).status,
      ).toBe(200);
    });

    it('ignores archived issues when counting the column', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      const [first] = await fill(asOwner, progress.id, 2);
      await setLimit(asOwner, progress.id, 2, 'hard');
      await asOwner.issues({ issueId: first }).archive.post();
      const spare = (await createIssue(asOwner, todo.id)).data!;

      // An archived issue is off the board, so it no longer occupies the column.
      expect(
        (await asOwner.issues({ issueId: spare.id }).patch({ columnId: progress.id })).status,
      ).toBe(200);
    });
  });

  describe('automation', () => {
    // Subtask automation runs after the write that set it off. A hard limit must not
    // turn a move that already succeeded into a failed request, so the automation
    // leaves the issue where it is instead.
    it('leaves a subtask put rather than failing the parent move', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const done = await columnByName(asOwner, 'Done');
      await asOwner
        .projects({ projectKey: 'MKT' })
        .settings.subtasks.patch({ completeParent: false, closeSubtasks: true });

      const parent = (await createIssue(asOwner, todo.id, 'Parent')).data!;
      const sub = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: todo.id, title: 'Sub', parentId: parent.id });
      // Room for the parent and nothing else.
      await fill(asOwner, done.id, 1);
      await setLimit(asOwner, done.id, 2, 'hard');

      const moved = await asOwner.issues({ issueId: parent.id }).patch({ columnId: done.id });
      expect(moved.status).toBe(200);
      expect(moved.data?.columnId).toBe(done.id);

      const after = await asOwner.issues({ issueId: sub.data!.id }).get();
      expect(after.data?.columnId).toBe(todo.id);
    });

    it('still moves the subtask when the column has room', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const done = await columnByName(asOwner, 'Done');
      await asOwner
        .projects({ projectKey: 'MKT' })
        .settings.subtasks.patch({ completeParent: false, closeSubtasks: true });

      const parent = (await createIssue(asOwner, todo.id, 'Parent')).data!;
      const sub = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: todo.id, title: 'Sub', parentId: parent.id });
      await setLimit(asOwner, done.id, 2, 'hard');

      await asOwner.issues({ issueId: parent.id }).patch({ columnId: done.id });

      const after = await asOwner.issues({ issueId: sub.data!.id }).get();
      expect(after.data?.columnId).toBe(done.id);
    });
  });

  describe('bulk update', () => {
    it('refuses the whole batch when it would breach the limit', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      await fill(asOwner, progress.id, 1);
      await setLimit(asOwner, progress.id, 3, 'hard');
      const ids = await fill(asOwner, todo.id, 3);

      // Room for two, moving three: the batch is checked before anything is written,
      // so no issue moves rather than two moving and the third failing.
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.patch({ ids, patch: { columnId: progress.id } });
      expect(res.status).toBe(409);
      expect(res.error?.value).toMatchObject({ code: 'wip_limit_exceeded' });

      for (const id of ids) {
        const issue = await asOwner.issues({ issueId: id }).get();
        expect(issue.data?.columnId).toBe(todo.id);
      }
    });

    it('moves a batch that exactly fills the column', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      await setLimit(asOwner, progress.id, 3, 'hard');
      const ids = await fill(asOwner, todo.id, 3);

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.patch({ ids, patch: { columnId: progress.id } });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ updated: 3 });
    });

    it('counts only the issues the move would add to the column', async () => {
      const { asOwner } = await setupProject();
      const todo = await columnByName(asOwner, 'Todo');
      const progress = await columnByName(asOwner, 'In Progress');
      const already = await fill(asOwner, progress.id, 2);
      await setLimit(asOwner, progress.id, 3, 'hard');
      const [incoming] = await fill(asOwner, todo.id, 1);

      // Two of the three are already there, so the batch adds one and fits.
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.patch({ ids: [...already, incoming], patch: { columnId: progress.id } });
      expect(res.status).toBe(200);
    });
  });
});
