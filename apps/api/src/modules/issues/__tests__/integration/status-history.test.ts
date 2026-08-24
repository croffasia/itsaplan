import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The stretches an issue spends in a column, kept in issue_status and read back
// through GET /issues/:issueId/timeline and the issue's statusSince. The rows are
// written by the routes that change an issue's column, so every case here builds
// its state through them.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columns = view.data!.columns;
  return {
    asOwner,
    todoId: columns.find((c) => c.name === 'Todo')!.id,
    startedId: columns.find((c) => c.stateType === 'started')!.id,
    doneId: columns.find((c) => c.stateType === 'completed')!.id,
  };
}

function createIssue(api: Api, columnId: number) {
  return api.projects({ projectKey: 'MKT' }).issues.post({ title: 'Task', columnId });
}

function moveIssue(api: Api, issueId: number, columnId: number) {
  return api.issues({ issueId }).patch({ columnId });
}

function timeline(api: Api, issueId: number) {
  return api.issues({ issueId }).timeline.get();
}

describe('issue status history', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('opens the first stretch where the issue is created, starting when it does', async () => {
    const { asOwner, todoId } = await setup();
    const issue = (await createIssue(asOwner, todoId)).data!;

    const res = await timeline(asOwner, issue.id);
    expect(res.status).toBe(200);
    expect(res.data!.length).toBe(1);
    expect(res.data![0]).toMatchObject({ status: 'Todo', to: null });
    expect(new Date(res.data![0]!.from).getTime()).toBe(new Date(issue.createdAt).getTime());
  });

  it('closes the open stretch and opens one on every move, leaving a single open one', async () => {
    const { asOwner, todoId, startedId, doneId } = await setup();
    const issue = (await createIssue(asOwner, todoId)).data!;
    await moveIssue(asOwner, issue.id, startedId);
    await moveIssue(asOwner, issue.id, doneId);

    const segments = (await timeline(asOwner, issue.id)).data!;
    expect(segments.map((s) => s.status)).toEqual(['Todo', 'In Progress', 'Done']);
    expect(segments.filter((s) => s.to === null).length).toBe(1);
    expect(segments[2]!.to).toBeNull();
    // The stretches meet: each one ends where the next begins.
    expect(segments[0]!.to).toEqual(segments[1]!.from);
    expect(segments[1]!.to).toEqual(segments[2]!.from);
  });

  it('reads a renamed column as one lane, under the name it carries now', async () => {
    const { asOwner, todoId, startedId } = await setup();
    const issue = (await createIssue(asOwner, todoId)).data!;
    await moveIssue(asOwner, issue.id, startedId);
    await asOwner.projects({ projectKey: 'MKT' }).columns({ columnId: todoId }).patch({
      name: 'Later',
    });
    await moveIssue(asOwner, issue.id, todoId);

    const segments = (await timeline(asOwner, issue.id)).data!;
    expect(segments.map((s) => s.status)).toEqual(['Later', 'In Progress', 'Later']);
  });

  it('keeps the stretches spent in a deleted column, still named', async () => {
    const { asOwner, todoId, startedId } = await setup();
    const issue = (await createIssue(asOwner, todoId)).data!;
    await moveIssue(asOwner, issue.id, startedId);
    await asOwner
      .projects({ projectKey: 'MKT' })
      .columns({ columnId: todoId })
      .delete({ mode: 'delete' });

    const segments = (await timeline(asOwner, issue.id)).data!;
    expect(segments.map((s) => s.status)).toEqual(['Todo', 'In Progress']);
  });

  it('opens a stretch in the target column for every issue a column delete moves', async () => {
    const { asOwner, todoId, startedId } = await setup();
    const first = (await createIssue(asOwner, todoId)).data!;
    const second = (await createIssue(asOwner, todoId)).data!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      .columns({ columnId: todoId })
      .delete({ mode: 'move', targetColumnId: startedId });

    for (const issue of [first, second]) {
      const segments = (await timeline(asOwner, issue.id)).data!;
      expect(segments.map((s) => s.status)).toEqual(['Todo', 'In Progress']);
      expect(segments.filter((s) => s.to === null).length).toBe(1);
    }
  });

  it('sets statusSince to when the issue entered the column it is in now', async () => {
    const { asOwner, todoId, startedId } = await setup();
    const issue = (await createIssue(asOwner, todoId)).data!;
    await moveIssue(asOwner, issue.id, startedId);

    const segments = (await timeline(asOwner, issue.id)).data!;
    const after = (await asOwner.issues({ issueId: issue.id }).get()).data!;
    expect(new Date(after.statusSince).getTime()).toBe(new Date(segments[1]!.from).getTime());
  });

  it('starts statusSince at the creation of an issue that never moved', async () => {
    const { asOwner, todoId } = await setup();
    const issue = (await createIssue(asOwner, todoId)).data!;

    const after = (await asOwner.issues({ issueId: issue.id }).get()).data!;
    expect(new Date(after.statusSince).getTime()).toBe(new Date(issue.createdAt).getTime());
  });
});
