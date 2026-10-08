import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Moving an issue to another project of the same team: it takes the next number
// there, its old identifier keeps resolving, and what belongs to the source project is
// carried over by name or dropped. Its subtasks move with it.

async function setup() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const ops = (await asOwner.projects.post({ key: 'OPS', name: 'Operations' })).data!;
  const mkt = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!;
  const opsView = (await asOwner.projects({ projectKey: 'OPS' }).get()).data!;
  return { asOwner, ops, mktColumns: mkt.columns, opsColumns: opsView.columns };
}

function createIssue(client: Api, columnId: number, title = 'Task', parentId?: number) {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title, parentId });
}

async function read(client: Api, issueId: number) {
  return (await client.issues({ issueId }).get()).data!;
}

describe('move issue', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('gives the issue the next number of the target and keeps the old one resolving', async () => {
    const { asOwner, ops, mktColumns, opsColumns } = await setup();
    const started = mktColumns.find((c) => c.stateType === 'started')!;
    const issue = (await createIssue(asOwner, started.id)).data!;

    const res = await asOwner.issues({ issueId: issue.id }).move.post({ projectId: ops.id });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      id: issue.id,
      projectId: ops.id,
      identifier: `OPS-${res.data!.sequenceNumber}`,
      columnId: opsColumns.find((c) => c.stateType === 'started')!.id,
    });

    const old = await asOwner
      .projects({ projectKey: 'MKT' })
      .issues({ sequenceNumber: issue.sequenceNumber })
      .get();
    expect(old.status).toBe(200);
    expect(old.data).toMatchObject({ id: issue.id, identifier: res.data!.identifier });

    const next = (await createIssue(asOwner, started.id)).data!;
    expect(next.sequenceNumber).toBe(issue.sequenceNumber + 1);
  });

  it('puts the issue in the column it is given', async () => {
    const { asOwner, ops, mktColumns, opsColumns } = await setup();
    const issue = (await createIssue(asOwner, mktColumns[0].id)).data!;
    const done = opsColumns.find((c) => c.stateType === 'completed')!;

    const res = await asOwner
      .issues({ issueId: issue.id })
      .move.post({ projectId: ops.id, columnId: done.id });
    expect(res.data?.columnId).toBe(done.id);

    const foreign = await asOwner
      .issues({ issueId: issue.id })
      .move.post({ projectId: ops.id, columnId: mktColumns[0].id });
    expect(foreign.status).toBe(400);
  });

  it('carries labels and custom fields over by name and drops the rest', async () => {
    const { asOwner, ops, mktColumns } = await setup();
    const mkt = asOwner.projects({ projectKey: 'MKT' });
    const opsApi = asOwner.projects({ projectKey: 'OPS' });
    const shared = (await mkt.labels.post({ name: 'urgent-fix' })).data!;
    const only = (await mkt.labels.post({ name: 'mkt-only' })).data!;
    const opsShared = (await opsApi.labels.post({ name: 'urgent-fix' })).data!;
    const field = (await mkt['custom-fields'].post({ name: 'Notes', fieldType: 'text' })).data!;
    const gone = (await mkt['custom-fields'].post({ name: 'Budget', fieldType: 'number' })).data!;
    const opsField = (await opsApi['custom-fields'].post({ name: 'Notes', fieldType: 'text' }))
      .data!;
    const issue = (
      await mkt.issues.post({
        columnId: mktColumns[0].id,
        title: 'Task',
        labelIds: [shared.id, only.id],
      })
    ).data!;
    await asOwner.issues({ issueId: issue.id }).fields({ fieldId: field.id }).put({ value: 'hi' });
    await asOwner.issues({ issueId: issue.id }).fields({ fieldId: gone.id }).put({ value: 5 });

    await asOwner.issues({ issueId: issue.id }).move.post({ projectId: ops.id });

    const after = await read(asOwner, issue.id);
    expect(after.labelIds).toEqual([opsShared.id]);
    expect(after.fields.find((f) => f.fieldId === opsField.id)?.value).toBe('hi');
    expect(after.fields.some((f) => f.fieldId === gone.id)).toBe(false);
  });

  it('moves the subtasks with their parent and detaches a subtask moved alone', async () => {
    const { asOwner, ops, mktColumns } = await setup();
    const parent = (await createIssue(asOwner, mktColumns[0].id, 'Parent')).data!;
    const a = (await createIssue(asOwner, mktColumns[0].id, 'A', parent.id)).data!;
    const b = (await createIssue(asOwner, mktColumns[0].id, 'B', parent.id)).data!;

    await asOwner.issues({ issueId: b.id }).move.post({ projectId: ops.id });
    expect((await read(asOwner, b.id)).parentId).toBeNull();

    await asOwner.issues({ issueId: parent.id }).move.post({ projectId: ops.id });
    const moved = await read(asOwner, a.id);
    expect(moved).toMatchObject({ projectId: ops.id, parentId: parent.id });
    expect((await read(asOwner, parent.id)).subtasks.map((s) => s.id)).toEqual([a.id]);
  });

  it('lists the watchers of the target project when read by the old number', async () => {
    const { asOwner, ops, mktColumns } = await setup();
    const user = await signUpTestUser({ name: 'Member' });
    const asMember = authedApi(user.cookie);
    const invite = await asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: user.email, role: 'member' });
    await asMember.invites({ token: invite.data!.token }).accept.post();
    await asOwner
      .projects({ projectKey: 'OPS' })
      .members.post({ userId: user.userId, role: 'member' });
    const issue = (await createIssue(asOwner, mktColumns[0].id)).data!;
    await asMember.issues({ issueId: issue.id }).watch.post();

    await asOwner.issues({ issueId: issue.id }).move.post({ projectId: ops.id });
    await asOwner.projects({ projectKey: 'MKT' }).members({ userId: user.userId }).delete();

    const old = await asOwner
      .projects({ projectKey: 'MKT' })
      .issues({ sequenceNumber: issue.sequenceNumber })
      .get();
    expect(old.data?.watchers.map((w) => w.userId)).toContain(user.userId);
  });

  it('drops the links to issues that stay behind', async () => {
    const { asOwner, ops, mktColumns } = await setup();
    const issue = (await createIssue(asOwner, mktColumns[0].id)).data!;
    const other = (await createIssue(asOwner, mktColumns[0].id, 'Other')).data!;
    await asOwner
      .issues({ issueId: issue.id })
      .links.post({ targetIssueId: other.id, kind: 'relates' });

    await asOwner.issues({ issueId: issue.id }).move.post({ projectId: ops.id });
    expect((await read(asOwner, other.id)).links).toEqual([]);
  });

  it('refuses the project the issue is in and a project of another team', async () => {
    const { asOwner, mktColumns } = await setup();
    const issue = (await createIssue(asOwner, mktColumns[0].id)).data!;
    const mkt = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!;
    const same = await asOwner
      .issues({ issueId: issue.id })
      .move.post({ projectId: mkt.project.id });
    expect(same.status).toBe(400);

    const team = (await asOwner.teams.post({ name: 'Second', slug: 'second' })).data!;
    const other = (
      await asOwner.teams({ teamId: team.id }).projects.post({ key: 'SEC', name: 'Second' })
    ).data!;
    const res = await asOwner.issues({ issueId: issue.id }).move.post({ projectId: other.id });
    expect(res.status).toBe(400);
  });

  it('answers 404 for an unknown issue or target project', async () => {
    const { asOwner, ops, mktColumns } = await setup();
    const issue = (await createIssue(asOwner, mktColumns[0].id)).data!;
    const noIssue = await asOwner.issues({ issueId: issue.id + 1000 }).move.post({
      projectId: ops.id,
    });
    expect(noIssue.status).toBe(404);
    const noProject = await asOwner.issues({ issueId: issue.id }).move.post({
      projectId: ops.id + 1000,
    });
    expect(noProject.status).toBe(404);
  });

  it('refuses a target column at a hard WIP limit', async () => {
    const { asOwner, ops, mktColumns, opsColumns } = await setup();
    const full = opsColumns[0];
    await asOwner
      .projects({ projectKey: 'OPS' })
      .columns({ columnId: full.id })
      .patch({ wipLimit: 1, wipMode: 'hard' });
    await asOwner.projects({ projectKey: 'OPS' }).issues.post({ columnId: full.id, title: 'In' });
    const issue = (await createIssue(asOwner, mktColumns[0].id)).data!;

    const res = await asOwner
      .issues({ issueId: issue.id })
      .move.post({ projectId: ops.id, columnId: full.id });
    expect(res.status).toBe(409);
    expect((await read(asOwner, issue.id)).projectId).not.toBe(ops.id);
  });

  it('refuses a caller who cannot create issues in the target', async () => {
    const { asOwner, ops, mktColumns } = await setup();
    const issue = (await createIssue(asOwner, mktColumns[0].id)).data!;
    const user = await signUpTestUser({ name: 'Member' });
    const invite = await asOwner
      .projects({ projectKey: 'MKT' })
      .invites.post({ email: user.email, role: 'owner' });
    const asMember = authedApi(user.cookie);
    await asMember.invites({ token: invite.data!.token }).accept.post();

    const res = await asMember.issues({ issueId: issue.id }).move.post({ projectId: ops.id });
    expect(res.status).toBe(403);
    expect((await read(asOwner, issue.id)).projectId).not.toBe(ops.id);
  });
});
