import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

async function setupOwnerProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  const project = await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner, projectId: project.data!.id };
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
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
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
