import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { addProjectMember } from '#tests/helpers/members';
import { resetDb } from '#tests/helpers/db';

// A deactivated account keeps its projects and its issues, but it cannot sign in and
// nothing reaches it, so no one is handed new work in its name. The API refuses it as
// a new assignee, and still takes a write that keeps the assignee an issue has. The
// owner is the first account, so also god: it is the one that deactivates.

async function setup() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  await addProjectMember(asOwner, 'MKT');
  await addProjectMember(asOwner, 'MKT');
  const project = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!;
  const [leaver, stayer] = project.assignees
    .filter((a) => a.kind === 'member' && a.userId !== owner.userId)
    .map((a) => a.userId);
  return { asOwner, leaver, stayer, columns: project.columns };
}

function deactivate(asOwner: Api, userId: string) {
  return asOwner.god.users({ userId }).deactivate.post();
}

function project(asOwner: Api) {
  return asOwner.projects({ projectKey: 'MKT' });
}

async function createIssue(asOwner: Api, columnId: number, assigneeUserId?: string) {
  return project(asOwner).issues.post({ columnId, title: 'Task', assigneeUserId });
}

describe('deactivated accounts as assignees', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('flags each assignee candidate as active or deactivated', async () => {
    const { asOwner, leaver, stayer } = await setup();
    await deactivate(asOwner, leaver);

    const { assignees } = (await project(asOwner).get()).data!;

    expect(assignees.find((a) => a.userId === leaver)?.active).toBe(false);
    expect(assignees.find((a) => a.userId === stayer)?.active).toBe(true);
  });

  it('refuses a deactivated account as the assignee of a new issue', async () => {
    const { asOwner, leaver, stayer, columns } = await setup();
    await deactivate(asOwner, leaver);

    const refused = await createIssue(asOwner, columns[0].id, leaver);
    expect(refused.status).toBe(400);

    const accepted = await createIssue(asOwner, columns[0].id, stayer);
    expect(accepted.status).toBe(201);
    expect(accepted.data).toMatchObject({ assigneeUserId: stayer });
  });

  it('refuses a change of assignee to a deactivated account', async () => {
    const { asOwner, leaver, columns } = await setup();
    const issue = (await createIssue(asOwner, columns[0].id)).data!;
    await deactivate(asOwner, leaver);

    const res = await asOwner.issues({ issueId: issue.id }).patch({ assigneeUserId: leaver });

    expect(res.status).toBe(400);
    const after = (await asOwner.issues({ issueId: issue.id }).get()).data!;
    expect(after.assigneeUserId).toBeNull();
  });

  describe('an issue already assigned to the account', () => {
    async function assignedThenDeactivated() {
      const ctx = await setup();
      const issue = (await createIssue(ctx.asOwner, ctx.columns[0].id, ctx.leaver)).data!;
      await deactivate(ctx.asOwner, ctx.leaver);
      return { ...ctx, issue };
    }

    it('still reports the account as its assignee', async () => {
      const { asOwner, leaver, issue } = await assignedThenDeactivated();

      const read = (await asOwner.issues({ issueId: issue.id }).get()).data!;

      expect(read.assigneeUserId).toBe(leaver);
    });

    it('keeps the assignee when another field is edited', async () => {
      const { asOwner, leaver, issue } = await assignedThenDeactivated();

      const res = await asOwner.issues({ issueId: issue.id }).patch({ title: 'Renamed' });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ title: 'Renamed', assigneeUserId: leaver });
    });

    it('accepts a write that sends the same assignee back', async () => {
      const { asOwner, leaver, issue } = await assignedThenDeactivated();

      const res = await asOwner
        .issues({ issueId: issue.id })
        .patch({ title: 'Renamed', assigneeUserId: leaver });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ title: 'Renamed', assigneeUserId: leaver });
    });

    it('lets the assignee be cleared or replaced with an active member', async () => {
      const { asOwner, stayer, issue } = await assignedThenDeactivated();

      const replaced = await asOwner
        .issues({ issueId: issue.id })
        .patch({ assigneeUserId: stayer });
      expect(replaced.status).toBe(200);
      expect(replaced.data).toMatchObject({ assigneeUserId: stayer });

      const cleared = await asOwner.issues({ issueId: issue.id }).patch({ assigneeUserId: null });
      expect(cleared.status).toBe(200);
      expect(cleared.data).toMatchObject({ assigneeUserId: null });
    });

    it('does not take the account back once it was replaced', async () => {
      const { asOwner, leaver, stayer, issue } = await assignedThenDeactivated();
      await asOwner.issues({ issueId: issue.id }).patch({ assigneeUserId: stayer });

      const res = await asOwner.issues({ issueId: issue.id }).patch({ assigneeUserId: leaver });

      expect(res.status).toBe(400);
    });
  });

  it('offers a reactivated account again', async () => {
    const { asOwner, leaver, columns } = await setup();
    await deactivate(asOwner, leaver);
    expect((await createIssue(asOwner, columns[0].id, leaver)).status).toBe(400);

    await asOwner.god.users({ userId: leaver }).reactivate.post();

    expect((await createIssue(asOwner, columns[0].id, leaver)).status).toBe(201);
    const { assignees } = (await project(asOwner).get()).data!;
    expect(assignees.find((a) => a.userId === leaver)?.active).toBe(true);
  });

  describe('bulk update', () => {
    it('refuses to hand issues to a deactivated account, and changes none of them', async () => {
      const { asOwner, leaver, columns } = await setup();
      const a = (await createIssue(asOwner, columns[0].id)).data!;
      const b = (await createIssue(asOwner, columns[0].id)).data!;
      await deactivate(asOwner, leaver);

      const res = await project(asOwner).issues.bulk.patch({
        ids: [a.id, b.id],
        patch: { assigneeUserId: leaver },
      });

      expect(res.status).toBe(400);
      expect((await asOwner.issues({ issueId: a.id }).get()).data!.assigneeUserId).toBeNull();
      expect((await asOwner.issues({ issueId: b.id }).get()).data!.assigneeUserId).toBeNull();
    });

    it('refuses before writing when only some issues already hold the account', async () => {
      const { asOwner, leaver, columns } = await setup();
      const held = (await createIssue(asOwner, columns[0].id, leaver)).data!;
      const free = (await createIssue(asOwner, columns[0].id)).data!;
      await deactivate(asOwner, leaver);

      const res = await project(asOwner).issues.bulk.patch({
        ids: [held.id, free.id],
        patch: { assigneeUserId: leaver, priority: 'high' },
      });

      expect(res.status).toBe(400);
      expect((await asOwner.issues({ issueId: held.id }).get()).data!.priority).not.toBe('high');
    });

    it('takes another field for issues held by a deactivated account', async () => {
      const { asOwner, leaver, columns } = await setup();
      const held = (await createIssue(asOwner, columns[0].id, leaver)).data!;
      await deactivate(asOwner, leaver);

      const res = await project(asOwner).issues.bulk.patch({
        ids: [held.id],
        patch: { priority: 'high' },
      });

      expect(res.status).toBe(200);
      const after = (await asOwner.issues({ issueId: held.id }).get()).data!;
      expect(after).toMatchObject({ priority: 'high', assigneeUserId: leaver });
    });
  });

  describe('column auto-assignee', () => {
    function patchColumn(
      asOwner: Api,
      columnId: number,
      body: { name?: string; autoAssignUserId?: string | null },
    ) {
      return project(asOwner).columns({ columnId }).patch(body);
    }

    it('refuses a deactivated account, on create and on update', async () => {
      const { asOwner, leaver, columns } = await setup();
      await deactivate(asOwner, leaver);

      const updated = await patchColumn(asOwner, columns[1].id, { autoAssignUserId: leaver });
      const created = await project(asOwner).columns.post({
        name: 'Review',
        stateType: 'started',
        autoAssignUserId: leaver,
      });

      expect(updated.status).toBe(400);
      expect(created.status).toBe(400);
    });

    it('takes a save that keeps the auto-assignee the column has', async () => {
      const { asOwner, leaver, columns } = await setup();
      await patchColumn(asOwner, columns[1].id, { autoAssignUserId: leaver });
      await deactivate(asOwner, leaver);

      const res = await patchColumn(asOwner, columns[1].id, {
        name: 'Doing',
        autoAssignUserId: leaver,
      });

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ name: 'Doing', autoAssignUserId: leaver });
    });

    it('still takes the issue, and leaves its assignee unchanged', async () => {
      const { asOwner, leaver, stayer, columns } = await setup();
      const target = columns[1].id;
      await patchColumn(asOwner, target, { autoAssignUserId: leaver });
      const moved = (await createIssue(asOwner, columns[0].id, stayer)).data!;
      await deactivate(asOwner, leaver);

      const move = await asOwner.issues({ issueId: moved.id }).patch({ columnId: target });
      expect(move.status).toBe(200);
      expect(move.data).toMatchObject({ columnId: target, assigneeUserId: stayer });

      const created = await createIssue(asOwner, target);
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ columnId: target, assigneeUserId: null });
    });
  });

  describe('issue templates', () => {
    function templates(asOwner: Api) {
      return project(asOwner)['issue-templates'];
    }

    it('refuses a deactivated account as the preset assignee', async () => {
      const { asOwner, leaver } = await setup();
      await deactivate(asOwner, leaver);

      const res = await templates(asOwner).post({ name: 'Bug', assigneeUserId: leaver });

      expect(res.status).toBe(400);
    });

    it('takes a save that keeps the preset assignee, and one that replaces it', async () => {
      const { asOwner, leaver, stayer } = await setup();
      const template = (await templates(asOwner).post({ name: 'Bug', assigneeUserId: leaver }))
        .data!;
      await deactivate(asOwner, leaver);

      const kept = await templates(asOwner)({ templateId: template.id }).patch({
        name: 'Defect',
        assigneeUserId: leaver,
      });
      expect(kept.status).toBe(200);
      expect(kept.data).toMatchObject({ name: 'Defect', assigneeUserId: leaver });

      const replaced = await templates(asOwner)({ templateId: template.id }).patch({
        assigneeUserId: stayer,
      });
      expect(replaced.status).toBe(200);
      expect(replaced.data).toMatchObject({ assigneeUserId: stayer });
    });
  });
});
