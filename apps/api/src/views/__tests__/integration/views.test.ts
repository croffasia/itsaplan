import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// Saved views are the tabs above a project's work items view. List and create are
// project-scoped (/projects/:projectKey/views), reorder is project-scoped, but
// patch and delete address a view by its own id (/views/:viewId) and resolve the
// owning project through the savedView guard. filters/display are jsonb blobs the
// store keeps verbatim; icon is nullable; position orders the tabs, first is 0.

async function setupOwnerProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  const project = await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner, projectId: project.data!.id };
}

describe('views', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create and list', () => {
    it('creates a view with default icon/filters/display and lists it', async () => {
      const { asOwner, projectId } = await setupOwnerProject();

      const created = await asOwner.projects({ projectKey: 'MKT' }).views.post({
        name: 'My issues',
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        name: 'My issues',
        projectId,
        icon: null,
        filters: {},
        display: {},
        position: 0,
      });
      expect(typeof created.data?.id).toBe('number');

      const list = await asOwner.projects({ projectKey: 'MKT' }).views.get();
      expect(list.status).toBe(200);
      expect(list.data).toHaveLength(1);
      expect(list.data?.[0]).toMatchObject({ name: 'My issues' });
    });

    it('stores icon, filters and display verbatim', async () => {
      const { asOwner } = await setupOwnerProject();
      const filters = { state: ['backlog'], assignee: [7] };
      const display = { group_by: 'state', order_by: '-created_at' };

      const created = await asOwner.projects({ projectKey: 'MKT' }).views.post({
        name: 'Backlog',
        icon: 'inbox',
        filters,
        display,
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ icon: 'inbox', filters, display });
    });

    it('appends each new view after the existing ones', async () => {
      const { asOwner } = await setupOwnerProject();

      await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'First' });
      await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Second' });

      const list = await asOwner.projects({ projectKey: 'MKT' }).views.get();
      expect(list.data).toMatchObject([
        { name: 'First', position: 0 },
        { name: 'Second', position: 1 },
      ]);
    });

    it('lists views ordered by position', async () => {
      const { asOwner } = await setupOwnerProject();
      const scope = asOwner.projects({ projectKey: 'MKT' }).views;
      const a = (await scope.post({ name: 'A' })).data!;
      const b = (await scope.post({ name: 'B' })).data!;
      const c = (await scope.post({ name: 'C' })).data!;

      const list = await scope.get();
      expect(list.data?.map((v) => v.id)).toEqual([a.id, b.id, c.id]);
    });
  });

  describe('update', () => {
    it('updates only the provided fields, replacing filters/display wholesale', async () => {
      const { asOwner } = await setupOwnerProject();
      const created = await asOwner.projects({ projectKey: 'MKT' }).views.post({
        name: 'Original',
        filters: { keep: true },
        display: { keep: true },
      });
      const id = created.data!.id;

      const patchedName = await asOwner.views({ viewId: id }).patch({ name: 'Renamed' });
      expect(patchedName.status).toBe(200);
      expect(patchedName.data).toMatchObject({
        name: 'Renamed',
        filters: { keep: true },
        display: { keep: true },
      });

      const patchedFilters = await asOwner
        .views({ viewId: id })
        .patch({ filters: { replaced: true } });
      expect(patchedFilters.status).toBe(200);
      expect(patchedFilters.data).toMatchObject({
        name: 'Renamed',
        filters: { replaced: true },
      });
    });

    it('sets and clears the icon', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (
        await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'V', icon: 'star' })
      ).data!.id;

      const cleared = await asOwner.views({ viewId: id }).patch({ icon: null });
      expect(cleared.status).toBe(200);
      expect(cleared.data).toMatchObject({ icon: null });

      const set = await asOwner.views({ viewId: id }).patch({ icon: 'flag' });
      expect(set.data).toMatchObject({ icon: 'flag' });
    });

    it('returns the current view for an empty patch', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'V' })).data!.id;

      const patched = await asOwner.views({ viewId: id }).patch({});
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ id, name: 'V' });
    });

    it('returns 404 when patching a missing view', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.views({ viewId: 999999 }).patch({ name: 'Nope' });
      expect(res.status).toBe(404);
    });

    it('rejects a patch that sets an empty name', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'V' })).data!.id;
      const res = await asOwner.views({ viewId: id }).patch({ name: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('reorder', () => {
    it('sets the order to the ids given', async () => {
      const { asOwner } = await setupOwnerProject();
      const a = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'A' })).data!;
      const b = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'B' })).data!;
      const c = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'C' })).data!;

      const reordered = await asOwner
        .projects({ projectKey: 'MKT' })
        .views.reorder.put({ orderedIds: [c.id, a.id, b.id] });
      expect(reordered.status).toBe(200);
      expect(reordered.data).toMatchObject([
        { id: c.id, position: 0 },
        { id: a.id, position: 1 },
        { id: b.id, position: 2 },
      ]);

      const list = await asOwner.projects({ projectKey: 'MKT' }).views.get();
      expect(list.data?.map((v) => v.id)).toEqual([c.id, a.id, b.id]);
    });

    it('ignores ids that belong to another project', async () => {
      const { asOwner } = await setupOwnerProject();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const mkt = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Mine' }))
        .data!;
      // The OPS view sits at position 0; the reorder below places its id at index
      // 1, so a scope leak would move it to position 1.
      const ops = (await asOwner.projects({ projectKey: 'OPS' }).views.post({ name: 'Theirs' }))
        .data!;

      const reordered = await asOwner
        .projects({ projectKey: 'MKT' })
        .views.reorder.put({ orderedIds: [mkt.id, ops.id] });
      expect(reordered.status).toBe(200);
      expect(reordered.data?.map((v) => v.id)).toEqual([mkt.id]);

      const opsList = await asOwner.projects({ projectKey: 'OPS' }).views.get();
      expect(opsList.data).toMatchObject([{ id: ops.id, position: 0 }]);
    });

    it('rejects a reorder with an empty list', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .views.reorder.put({ orderedIds: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('delete', () => {
    it('deletes a view', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Gone' })).data!
        .id;

      const del = await asOwner.views({ viewId: id }).delete();
      expect(del.status).toBe(204);

      const list = await asOwner.projects({ projectKey: 'MKT' }).views.get();
      expect(list.data).toHaveLength(0);
    });

    it('returns 404 when deleting a missing view', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.views({ viewId: 999999 }).delete();
      expect(res.status).toBe(404);
    });
  });

  describe('validation', () => {
    it('rejects a view with an empty name', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a non-numeric view id', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.views({ viewId: 'abc' }).patch({ name: 'Nope' });
      expect(res.status).toBe(400);
    });
  });

  describe('access', () => {
    it('returns 404 for an unknown project', async () => {
      const { asOwner } = await setupOwnerProject();
      const res = await asOwner.projects({ projectKey: 'NOPE' }).views.get();
      expect(res.status).toBe(404);
    });

    it('denies a non-member on project-scoped and entity routes', async () => {
      const { asOwner } = await setupOwnerProject();
      const viewId = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Secret' }))
        .data!.id;

      const outsider = authedApi((await signUpTestUser()).cookie);

      // Guard-thrown 403 is not in Treaty's inferred error-status union, so assert
      // the top-level HTTP status (typed number) rather than error.status.
      const list = await outsider.projects({ projectKey: 'MKT' }).views.get();
      expect(list.status).toBe(403);

      const create = await outsider
        .projects({ projectKey: 'MKT' })
        .views.post({ name: 'Intruder' });
      expect(create.status).toBe(403);

      const patch = await outsider.views({ viewId }).patch({ name: 'Hacked' });
      expect(patch.status).toBe(403);

      const reorder = await outsider
        .projects({ projectKey: 'MKT' })
        .views.reorder.put({ orderedIds: [viewId] });
      expect(reorder.status).toBe(403);

      const del = await outsider.views({ viewId }).delete();
      expect(del.status).toBe(403);
    });
  });
});
