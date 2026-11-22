import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

async function setupOwnerProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  const project = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  return { asOwner, owner, projectId: project.data!.id };
}

// Adds a member on the default role, which grants no `actions` permission.
async function addDefaultMember(asOwner: ReturnType<typeof authedApi>) {
  const user = await signUpTestUser();
  const invite = await asOwner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member' });
  const asMember = authedApi(user.cookie);
  await asMember.invites({ token: invite.data!.token }).accept.post();
  return asMember;
}

describe('actions', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create and list', () => {
    it('creates an action with default condition/effect and lists it', async () => {
      const { asOwner, projectId } = await setupOwnerProject();

      const created = await asOwner.projects({ projectKey: 'MKT' }).actions.post({
        name: 'Auto-close',
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        name: 'Auto-close',
        projectId,
        icon: '',
        condition: {},
        effect: {},
        position: 0,
      });
      expect(typeof created.data?.id).toBe('number');

      const list = await asOwner.projects({ projectKey: 'MKT' }).actions.get();
      expect(list.status).toBe(200);
      expect(list.data).toHaveLength(1);
      expect(list.data?.[0]).toMatchObject({ name: 'Auto-close' });
    });

    it('stores the icon and updates it', async () => {
      const { asOwner } = await setupOwnerProject();

      const created = await asOwner.projects({ projectKey: 'MKT' }).actions.post({
        name: 'Approve',
        icon: 'check',
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ name: 'Approve', icon: 'check' });

      const patched = await asOwner
        .actions({ actionId: created.data!.id })
        .patch({ icon: 'rocket' });
      expect(patched.data).toMatchObject({ icon: 'rocket' });
    });

    it('stores condition and effect verbatim', async () => {
      const { asOwner } = await setupOwnerProject();
      const condition = { all: [{ field: 'priority', eq: 'high' }] };
      const effect = { columnId: 3, assigneeId: 7 };

      const created = await asOwner.projects({ projectKey: 'MKT' }).actions.post({
        name: 'Escalate',
        condition,
        effect,
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ condition, effect });
    });

    it('appends each new action after the existing ones', async () => {
      const { asOwner } = await setupOwnerProject();

      await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'First' });
      await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'Second' });

      const list = await asOwner.projects({ projectKey: 'MKT' }).actions.get();
      expect(list.data).toMatchObject([
        { name: 'First', position: 0 },
        { name: 'Second', position: 1 },
      ]);
    });
  });

  describe('quick list', () => {
    it('lets a member without the actions permission read it, in saved order', async () => {
      const { asOwner } = await setupOwnerProject();
      const a = (await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'A' })).data!;
      const b = (await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'B' })).data!;
      await asOwner
        .projects({ projectKey: 'MKT' })
        .actions.reorder.put({ orderedIds: [b.id, a.id] });

      const asMember = await addDefaultMember(asOwner);

      const settingsList = await asMember.projects({ projectKey: 'MKT' }).actions.get();
      expect(settingsList.status).toBe(403);

      const quick = await asMember.projects({ projectKey: 'MKT' }).actions.quick.get();
      expect(quick.status).toBe(200);
      expect(quick.data?.map((r) => r.id)).toEqual([b.id, a.id]);
    });

    it('denies a non-member', async () => {
      const { asOwner } = await setupOwnerProject();
      await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'Secret' });

      const outsider = authedApi((await signUpTestUser()).cookie);
      const quick = await outsider.projects({ projectKey: 'MKT' }).actions.quick.get();
      expect(quick.status).toBe(403);
    });

    it('returns 404 for an unknown project', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.projects({ projectKey: 'NOPE' }).actions.quick.get();
      expect(res.status).toBe(404);
    });
  });

  describe('apply', () => {
    it('applies state, priority and labels while keeping the assignee after deactivation', async () => {
      const { asOwner, owner } = await setupOwnerProject();
      await addDefaultMember(asOwner);
      const project = asOwner.projects({ projectKey: 'MKT' });
      const { assignees, columns } = (await project.get()).data!;
      const departing = assignees.find((a) => a.userId !== owner.userId)!.userId;
      const created = await project.issues.post({
        title: 'Task',
        columnId: columns[0].id,
        assigneeUserId: owner.userId,
      });
      const label = (await project.labels.post({ name: 'Urgent' })).data!;
      const saved = await project.actions.post({
        name: 'Escalate',
        effect: {
          assigneeUserId: departing,
          columnId: columns[1].id,
          priority: 'high',
          labelIds: [label.id],
        },
      });
      expect(saved.status).toBe(201);
      expect((await asOwner.god.users({ userId: departing }).deactivate.post()).status).toBe(200);

      const item = asOwner.issues({ issueId: created.data!.id });
      const result = await item.actions({ actionId: saved.data!.id }).post({
        effect: { columnId: columns[1].id, priority: 'high', labelIds: [label.id] },
      });
      expect(result.status).toBe(200);
      expect((await item.get()).data).toMatchObject({
        assigneeUserId: owner.userId,
        columnId: columns[1].id,
        priority: 'high',
        labelIds: [label.id],
      });
      expect((await project.actions.quick.get()).data?.[0]?.effect).toMatchObject({
        assigneeUserId: departing,
      });
    });

    it('assigns an active member, ignores an unavailable assignment and clears an assignee', async () => {
      const { asOwner, owner } = await setupOwnerProject();
      await addDefaultMember(asOwner);
      const project = asOwner.projects({ projectKey: 'MKT' });
      const { assignees, columns } = (await project.get()).data!;
      const member = assignees.find((a) => a.userId !== owner.userId)!.userId;
      const created = await project.issues.post({ title: 'Task', columnId: columns[0].id });
      const item = asOwner.issues({ issueId: created.data!.id });
      const assign = await project.actions.post({
        name: 'Assign',
        effect: { assigneeUserId: member },
      });
      const run = item.actions({ actionId: assign.data!.id });
      const assigned = await run.post({ effect: { assigneeUserId: member } });
      expect(assigned.status).toBe(200);
      expect(assigned.data!.assigneeUserId).toBe(member);

      expect((await asOwner.god.users({ userId: member }).deactivate.post()).status).toBe(200);
      await item.patch({ assigneeUserId: owner.userId });
      const skipped = await run.post({ effect: {} });
      expect(skipped.status).toBe(200);
      expect(skipped.data!.assigneeUserId).toBe(owner.userId);

      const clear = await project.actions.post({ name: 'Clear', effect: { assigneeUserId: null } });
      const cleared = await item
        .actions({ actionId: clear.data!.id })
        .post({ effect: { assigneeUserId: null } });
      expect(cleared.status).toBe(200);
      expect(cleared.data!.assigneeUserId).toBeNull();
    });

    it('requires a fresh confirmation after the saved effect changes', async () => {
      const { asOwner } = await setupOwnerProject();
      const project = asOwner.projects({ projectKey: 'MKT' });
      const { columns } = (await project.get()).data!;
      const created = await project.issues.post({ title: 'Task', columnId: columns[0].id });
      const saved = await project.actions.post({
        name: 'Set priority',
        effect: { priority: 'high' },
      });
      const actionId = saved.data!.id;
      const item = asOwner.issues({ issueId: created.data!.id });
      const run = item.actions({ actionId });
      expect((await run.post(undefined as never)).status).toBe(400);
      expect(
        (await asOwner.actions({ actionId }).patch({ effect: { priority: 'urgent' } })).status,
      ).toBe(200);

      const stale = await run.post({ effect: { priority: 'high' } });
      expect(stale.status).toBe(409);
      expect(stale.error?.value).toMatchObject({ code: 'ACTION_EFFECT_CHANGED' });
      expect((await item.get()).data!.priority).toBeNull();

      const applied = await run.post({ effect: { priority: 'urgent' } });
      expect(applied.status).toBe(200);
      expect(applied.data!.priority).toBe('urgent');
    });

    it('requires fresh confirmation before adding a reactivated assignee', async () => {
      const { asOwner, owner } = await setupOwnerProject();
      await addDefaultMember(asOwner);
      const project = asOwner.projects({ projectKey: 'MKT' });
      const { assignees, columns } = (await project.get()).data!;
      const member = assignees.find((a) => a.userId !== owner.userId)!.userId;
      const created = await project.issues.post({ title: 'Task', columnId: columns[0].id });
      const effect = { priority: 'high', assigneeUserId: member };
      const saved = await project.actions.post({ name: 'Escalate', effect });
      const account = asOwner.god.users({ userId: member });
      expect((await account.deactivate.post()).status).toBe(200);
      const confirmedEffect = { priority: effect.priority };
      expect((await account.reactivate.post()).status).toBe(200);

      const item = asOwner.issues({ issueId: created.data!.id });
      const run = item.actions({ actionId: saved.data!.id });
      expect((await run.post({ effect: confirmedEffect })).status).toBe(409);
      expect((await item.get()).data).toMatchObject({ priority: null, assigneeUserId: null });

      const applied = await run.post({ effect });
      expect(applied.status).toBe(200);
      expect(applied.data).toMatchObject(effect);
    });

    it('requires confirmation of the destination column auto-assignee', async () => {
      const { asOwner, owner } = await setupOwnerProject();
      const project = asOwner.projects({ projectKey: 'MKT' });
      const { columns } = (await project.get()).data!;
      const created = await project.issues.post({ title: 'Task', columnId: columns[0].id });
      const effect = { columnId: columns[1].id };
      const saved = await project.actions.post({ name: 'Move', effect });
      expect(
        (
          await project
            .columns({ columnId: effect.columnId })
            .patch({ autoAssignUserId: owner.userId })
        ).status,
      ).toBe(200);

      const item = asOwner.issues({ issueId: created.data!.id });
      const run = item.actions({ actionId: saved.data!.id });
      expect((await run.post({ effect })).status).toBe(409);
      expect((await item.get()).data).toMatchObject({
        columnId: columns[0].id,
        assigneeUserId: null,
      });

      const applied = await run.post({ effect: { ...effect, assigneeUserId: owner.userId } });
      expect(applied.status).toBe(200);
      expect(applied.data).toMatchObject({ ...effect, assigneeUserId: owner.userId });
    });

    it('requires issue edit permission and an action from the issue project', async () => {
      const { asOwner } = await setupOwnerProject();
      const project = asOwner.projects({ projectKey: 'MKT' });
      const view = await project.get();
      const created = await project.issues.post({
        title: 'Task',
        columnId: view.data!.columns[0].id,
      });
      const issueId = created.data!.id;
      const local = await project.actions.post({ name: 'Local', effect: { priority: 'high' } });
      const outsider = authedApi((await signUpTestUser()).cookie);
      expect(
        (
          await outsider
            .issues({ issueId })
            .actions({ actionId: local.data!.id })
            .post({ effect: { priority: 'high' } })
        ).status,
      ).toBe(403);

      await createProject(asOwner, { key: 'OPS', name: 'Operations' });
      const foreign = await asOwner
        .projects({ projectKey: 'OPS' })
        .actions.post({ name: 'Foreign', effect: { priority: 'high' } });
      const item = asOwner.issues({ issueId });
      expect(
        (await item.actions({ actionId: foreign.data!.id }).post({ effect: { priority: 'high' } }))
          .status,
      ).toBe(404);
      expect((await item.get()).data!.priority).toBeNull();
    });
  });

  describe('update', () => {
    it('updates only the provided fields, replacing condition/effect wholesale', async () => {
      const { asOwner } = await setupOwnerProject();
      const created = await asOwner.projects({ projectKey: 'MKT' }).actions.post({
        name: 'Original',
        condition: { keep: true },
        effect: { keep: true },
      });
      const id = created.data!.id;

      const patchedName = await asOwner.actions({ actionId: id }).patch({ name: 'Renamed' });
      expect(patchedName.status).toBe(200);
      expect(patchedName.data).toMatchObject({
        name: 'Renamed',
        condition: { keep: true },
        effect: { keep: true },
      });

      const patchedEffect = await asOwner
        .actions({ actionId: id })
        .patch({ effect: { replaced: true } });
      expect(patchedEffect.status).toBe(200);
      expect(patchedEffect.data).toMatchObject({
        name: 'Renamed',
        effect: { replaced: true },
      });
    });

    it('returns 404 when patching a missing action', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.actions({ actionId: 999999 }).patch({ name: 'Nope' });
      expect(res.status).toBe(404);
    });
  });

  describe('reorder', () => {
    it('sets the order to the ids given', async () => {
      const { asOwner } = await setupOwnerProject();
      const a = (await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'A' })).data!;
      const b = (await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'B' })).data!;
      const c = (await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'C' })).data!;

      const reordered = await asOwner
        .projects({ projectKey: 'MKT' })
        .actions.reorder.put({ orderedIds: [c.id, a.id, b.id] });
      expect(reordered.status).toBe(200);
      expect(reordered.data).toMatchObject([
        { id: c.id, position: 0 },
        { id: a.id, position: 1 },
        { id: b.id, position: 2 },
      ]);

      const list = await asOwner.projects({ projectKey: 'MKT' }).actions.get();
      expect(list.data?.map((r) => r.id)).toEqual([c.id, a.id, b.id]);
    });

    it('ignores ids that belong to another project', async () => {
      const { asOwner } = await setupOwnerProject();
      await createProject(asOwner, { key: 'OPS', name: 'Operations' });
      const mkt = (await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'Mine' }))
        .data!;
      // The OPS action sits at position 0; the reorder below places its id at
      // index 1, so a scope leak would move it to position 1.
      const ops = (await asOwner.projects({ projectKey: 'OPS' }).actions.post({ name: 'Theirs' }))
        .data!;

      const reordered = await asOwner
        .projects({ projectKey: 'MKT' })
        .actions.reorder.put({ orderedIds: [mkt.id, ops.id] });
      expect(reordered.status).toBe(200);
      expect(reordered.data?.map((r) => r.id)).toEqual([mkt.id]);

      const opsList = await asOwner.projects({ projectKey: 'OPS' }).actions.get();
      expect(opsList.data).toMatchObject([{ id: ops.id, position: 0 }]);
    });
  });

  describe('delete', () => {
    it('deletes an action', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'Gone' }))
        .data!.id;

      const del = await asOwner.actions({ actionId: id }).delete();
      expect(del.status).toBe(204);

      const list = await asOwner.projects({ projectKey: 'MKT' }).actions.get();
      expect(list.data).toHaveLength(0);
    });

    it('returns 404 when deleting a missing action', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.actions({ actionId: 999999 }).delete();
      expect(res.status).toBe(404);
    });
  });

  describe('validation', () => {
    it('rejects an action with an empty name', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a reorder with an empty list', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .actions.reorder.put({ orderedIds: [] });
      expect(res.status).toBe(400);
    });

    it('rejects a patch that sets an empty name', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'Named' }))
        .data!.id;
      const res = await asOwner.actions({ actionId: id }).patch({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a non-numeric action id', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.actions({ actionId: 'abc' }).patch({ name: 'Nope' });
      expect(res.status).toBe(400);
    });
  });

  describe('access', () => {
    it('returns 404 for an unknown project', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.projects({ projectKey: 'NOPE' }).actions.get();
      expect(res.status).toBe(404);
    });

    it('denies a non-member on project-scoped and entity routes', async () => {
      const { asOwner } = await setupOwnerProject();
      const actionId = (
        await asOwner.projects({ projectKey: 'MKT' }).actions.post({ name: 'Secret' })
      ).data!.id;

      const outsider = authedApi((await signUpTestUser()).cookie);

      // Guard-thrown 403 is not in Treaty's inferred error-status union, so
      // assert the top-level HTTP status (typed number) rather than error.status.
      const list = await outsider.projects({ projectKey: 'MKT' }).actions.get();
      expect(list.status).toBe(403);

      const create = await outsider
        .projects({ projectKey: 'MKT' })
        .actions.post({ name: 'Intruder' });
      expect(create.status).toBe(403);

      const patch = await outsider.actions({ actionId }).patch({ name: 'Hacked' });
      expect(patch.status).toBe(403);

      const reorder = await outsider
        .projects({ projectKey: 'MKT' })
        .actions.reorder.put({ orderedIds: [actionId] });
      expect(reorder.status).toBe(403);

      const del = await outsider.actions({ actionId }).delete();
      expect(del.status).toBe(403);
    });
  });
});
