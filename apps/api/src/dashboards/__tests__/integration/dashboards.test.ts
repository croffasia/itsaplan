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

describe('dashboards', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create and list', () => {
    it('creates a dashboard with default icon/layout and lists it', async () => {
      const { asOwner, projectId } = await setupOwnerProject();

      const created = await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({
        name: 'Overview',
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        name: 'Overview',
        projectId,
        icon: null,
        layout: [],
        position: 0,
      });
      expect(typeof created.data?.id).toBe('number');

      const list = await asOwner.projects({ projectKey: 'MKT' }).dashboards.get();
      expect(list.status).toBe(200);
      expect(list.data).toHaveLength(1);
      expect(list.data?.[0]).toMatchObject({ name: 'Overview' });
    });

    it('stores icon and layout verbatim', async () => {
      const { asOwner } = await setupOwnerProject();
      const layout = [
        { id: 'w1', type: 'chart', x: 0, y: 0 },
        { id: 'w2', type: 'counter', x: 6, y: 0 },
      ];

      const created = await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({
        name: 'Delivery',
        icon: 'rocket',
        layout,
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ icon: 'rocket', layout });
    });

    it('appends each new dashboard after the existing ones', async () => {
      const { asOwner } = await setupOwnerProject();

      await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({ name: 'First' });
      await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({ name: 'Second' });

      const list = await asOwner.projects({ projectKey: 'MKT' }).dashboards.get();
      expect(list.data).toMatchObject([
        { name: 'First', position: 0 },
        { name: 'Second', position: 1 },
      ]);
    });
  });

  describe('update', () => {
    it('updates only the provided fields, replacing layout wholesale', async () => {
      const { asOwner } = await setupOwnerProject();
      const created = await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({
        name: 'Original',
        icon: 'chart',
        layout: [{ id: 'keep' }],
      });
      const id = created.data!.id;

      const patchedName = await asOwner.dashboards({ dashboardId: id }).patch({ name: 'Renamed' });
      expect(patchedName.status).toBe(200);
      expect(patchedName.data).toMatchObject({
        name: 'Renamed',
        icon: 'chart',
        layout: [{ id: 'keep' }],
      });

      const patchedLayout = await asOwner
        .dashboards({ dashboardId: id })
        .patch({ layout: [{ id: 'replaced' }] });
      expect(patchedLayout.status).toBe(200);
      expect(patchedLayout.data).toMatchObject({
        name: 'Renamed',
        layout: [{ id: 'replaced' }],
      });
    });

    it('clears the icon when patched to null', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          .dashboards.post({ name: 'Iconed', icon: 'star' })
      ).data!.id;

      const patched = await asOwner.dashboards({ dashboardId: id }).patch({ icon: null });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ icon: null });
    });

    it('returns 404 when patching a missing dashboard', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.dashboards({ dashboardId: 999999 }).patch({ name: 'Nope' });
      expect(res.status).toBe(404);
    });
  });

  describe('reorder', () => {
    it('sets the order to the ids given', async () => {
      const { asOwner } = await setupOwnerProject();
      const a = (await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({ name: 'A' }))
        .data!;
      const b = (await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({ name: 'B' }))
        .data!;
      const c = (await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({ name: 'C' }))
        .data!;

      const reordered = await asOwner
        .projects({ projectKey: 'MKT' })
        .dashboards.reorder.put({ orderedIds: [c.id, a.id, b.id] });
      expect(reordered.status).toBe(200);
      expect(reordered.data).toMatchObject([
        { id: c.id, position: 0 },
        { id: a.id, position: 1 },
        { id: b.id, position: 2 },
      ]);

      const list = await asOwner.projects({ projectKey: 'MKT' }).dashboards.get();
      expect(list.data?.map((r) => r.id)).toEqual([c.id, a.id, b.id]);
    });

    it('ignores ids that belong to another project', async () => {
      const { asOwner } = await setupOwnerProject();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const mkt = (await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({ name: 'Mine' }))
        .data!;
      // The OPS dashboard sits at position 0; the reorder below places its id at
      // index 1, so a scope leak would move it to position 1.
      const ops = (
        await asOwner.projects({ projectKey: 'OPS' }).dashboards.post({ name: 'Theirs' })
      ).data!;

      const reordered = await asOwner
        .projects({ projectKey: 'MKT' })
        .dashboards.reorder.put({ orderedIds: [mkt.id, ops.id] });
      expect(reordered.status).toBe(200);
      expect(reordered.data?.map((r) => r.id)).toEqual([mkt.id]);

      const opsList = await asOwner.projects({ projectKey: 'OPS' }).dashboards.get();
      expect(opsList.data).toMatchObject([{ id: ops.id, position: 0 }]);
    });
  });

  describe('delete', () => {
    it('deletes a dashboard', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({ name: 'Gone' }))
        .data!.id;

      const del = await asOwner.dashboards({ dashboardId: id }).delete();
      expect(del.status).toBe(204);

      const list = await asOwner.projects({ projectKey: 'MKT' }).dashboards.get();
      expect(list.data).toHaveLength(0);
    });

    it('returns 404 when deleting a missing dashboard', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.dashboards({ dashboardId: 999999 }).delete();
      expect(res.status).toBe(404);
    });
  });

  describe('validation', () => {
    it('rejects a dashboard with an empty name', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a reorder with an empty list', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .dashboards.reorder.put({ orderedIds: [] });
      expect(res.status).toBe(400);
    });

    it('rejects a patch that sets an empty name', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({ name: 'Named' }))
        .data!.id;
      const res = await asOwner.dashboards({ dashboardId: id }).patch({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a non-numeric dashboard id', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.dashboards({ dashboardId: 'abc' }).patch({ name: 'Nope' });
      expect(res.status).toBe(400);
    });
  });

  describe('access', () => {
    it('returns 404 for an unknown project', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.projects({ projectKey: 'NOPE' }).dashboards.get();
      expect(res.status).toBe(404);
    });

    it('denies a non-member on project-scoped and entity routes', async () => {
      const { asOwner } = await setupOwnerProject();
      const dashboardId = (
        await asOwner.projects({ projectKey: 'MKT' }).dashboards.post({ name: 'Secret' })
      ).data!.id;

      const outsider = authedApi((await signUpTestUser()).cookie);

      // Guard-thrown 403 is not in Treaty's inferred error-status union, so
      // assert the top-level HTTP status (typed number) rather than error.status.
      const list = await outsider.projects({ projectKey: 'MKT' }).dashboards.get();
      expect(list.status).toBe(403);

      const create = await outsider
        .projects({ projectKey: 'MKT' })
        .dashboards.post({ name: 'Intruder' });
      expect(create.status).toBe(403);

      const patch = await outsider.dashboards({ dashboardId }).patch({ name: 'Hacked' });
      expect(patch.status).toBe(403);

      const reorder = await outsider
        .projects({ projectKey: 'MKT' })
        .dashboards.reorder.put({ orderedIds: [dashboardId] });
      expect(reorder.status).toBe(403);

      const del = await outsider.dashboards({ dashboardId }).delete();
      expect(del.status).toBe(403);
    });
  });
});
