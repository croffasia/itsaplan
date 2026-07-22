import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// Labels and label groups belong to one project. There are no GET routes — both
// are read back through the project view (GET /projects/:projectKey), whose
// `labels` and `labelGroups` fields are listLabels()/listLabelGroups() ordered by
// name. A new project seeds neither, so both lists start empty. Names are unique
// within a project (UNIQUE (project_id, name) on each table → 409 on a duplicate).
// A label may belong to at most one group; deleting the group ungroups its labels
// (label.group_id -> SET NULL).

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

// The project's labels in name order.
async function labelsOf(client: Api, projectKey = 'MKT') {
  const view = await client.projects({ projectKey }).get();
  return view.data!.labels;
}

// The project's label groups in name order.
async function groupsOf(client: Api, projectKey = 'MKT') {
  const view = await client.projects({ projectKey }).get();
  return view.data!.labelGroups;
}

describe('labels', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create label', () => {
    it('creates a label with a default color and lists it in the view', async () => {
      const { asOwner } = await setupProject();

      const created = await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'urgent' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        name: 'urgent',
        color: '#6b7280',
        groupId: null,
      });
      expect(typeof created.data?.id).toBe('number');

      const labels = await labelsOf(asOwner);
      expect(labels.map((l) => l.name)).toEqual(['urgent']);
    });

    it('stores a provided color', async () => {
      const { asOwner } = await setupProject();
      const created = await asOwner
        .projects({ projectKey: 'MKT' })
        .labels.post({ name: 'bug', color: '#123456' });
      expect(created.data).toMatchObject({ name: 'bug', color: '#123456' });
    });

    it('assigns the label to a group', async () => {
      const { asOwner } = await setupProject();
      const group = (
        await asOwner.projects({ projectKey: 'MKT' })['label-groups'].post({ name: 'severity' })
      ).data!;

      const created = await asOwner
        .projects({ projectKey: 'MKT' })
        .labels.post({ name: 'urgent', groupId: group.id });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ groupId: group.id });
    });

    it('lists labels ordered by name', async () => {
      const { asOwner } = await setupProject();
      const scope = asOwner.projects({ projectKey: 'MKT' }).labels;
      await scope.post({ name: 'gamma' });
      await scope.post({ name: 'alpha' });
      await scope.post({ name: 'beta' });

      const labels = await labelsOf(asOwner);
      expect(labels.map((l) => l.name)).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('rejects an empty name', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate name within the project', async () => {
      const { asOwner } = await setupProject();
      const scope = asOwner.projects({ projectKey: 'MKT' }).labels;
      await scope.post({ name: 'urgent' });
      const res = await scope.post({ name: 'urgent' });
      expect(res.status).toBe(409);
    });

    it('allows the same name in a different project', async () => {
      const { asOwner } = await setupProject();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'urgent' });
      const res = await asOwner.projects({ projectKey: 'OPS' }).labels.post({ name: 'urgent' });
      expect(res.status).toBe(201);
    });
  });

  describe('update label', () => {
    it('updates the name and reflects it in the view', async () => {
      const { asOwner } = await setupProject();
      const label = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'urgent' }))
        .data!;

      const patched = await asOwner
        .projects({ projectKey: 'MKT' })
        .labels({ labelId: label.id })
        .patch({ name: 'critical' });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ name: 'critical' });

      const labels = await labelsOf(asOwner);
      expect(labels.find((l) => l.id === label.id)?.name).toBe('critical');
    });

    it('updates the color', async () => {
      const { asOwner } = await setupProject();
      const label = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'urgent' }))
        .data!;

      const patched = await asOwner
        .projects({ projectKey: 'MKT' })
        .labels({ labelId: label.id })
        .patch({ color: '#abcdef' });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ color: '#abcdef' });
    });

    it('assigns and clears the group', async () => {
      const { asOwner } = await setupProject();
      const group = (
        await asOwner.projects({ projectKey: 'MKT' })['label-groups'].post({ name: 'severity' })
      ).data!;
      const label = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'urgent' }))
        .data!;
      const scope = asOwner.projects({ projectKey: 'MKT' }).labels({ labelId: label.id });

      const grouped = await scope.patch({ groupId: group.id });
      expect(grouped.data).toMatchObject({ groupId: group.id });

      const ungrouped = await scope.patch({ groupId: null });
      expect(ungrouped.data).toMatchObject({ groupId: null });
    });

    it('returns the current label for an empty patch', async () => {
      const { asOwner } = await setupProject();
      const label = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'urgent' }))
        .data!;

      const patched = await asOwner
        .projects({ projectKey: 'MKT' })
        .labels({ labelId: label.id })
        .patch({});
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ id: label.id, name: 'urgent' });
    });

    it('returns 404 for a missing label', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .labels({ labelId: 999999 })
        .patch({ name: 'nope' });
      expect(res.status).toBe(404);
    });

    it('rejects an empty name', async () => {
      const { asOwner } = await setupProject();
      const label = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'urgent' }))
        .data!;
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .labels({ labelId: label.id })
        .patch({ name: '' });
      expect(res.status).toBe(400);
    });

    it("rejects renaming onto another label's name", async () => {
      const { asOwner } = await setupProject();
      const scope = asOwner.projects({ projectKey: 'MKT' }).labels;
      await scope.post({ name: 'urgent' });
      const bug = (await scope.post({ name: 'bug' })).data!;

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .labels({ labelId: bug.id })
        .patch({ name: 'urgent' });
      expect(res.status).toBe(409);
    });
  });

  describe('delete label', () => {
    it('removes the label from the view', async () => {
      const { asOwner } = await setupProject();
      const label = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'urgent' }))
        .data!;

      const del = await asOwner
        .projects({ projectKey: 'MKT' })
        .labels({ labelId: label.id })
        .delete();
      expect(del.status).toBe(204);

      const labels = await labelsOf(asOwner);
      expect(labels.map((l) => l.id)).not.toContain(label.id);
    });

    // The store deletes by (id, projectId) with no existence check, so a missing
    // id is a no-op that still returns 204.
    it('returns 204 for a missing label', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .labels({ labelId: 999999 })
        .delete();
      expect(res.status).toBe(204);
    });
  });

  describe('create label group', () => {
    it('creates a group with a default color and lists it in the view', async () => {
      const { asOwner } = await setupProject();

      const created = await asOwner
        .projects({ projectKey: 'MKT' })
        ['label-groups'].post({ name: 'severity' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ name: 'severity', color: '#6b7280' });
      expect(typeof created.data?.id).toBe('number');

      const groups = await groupsOf(asOwner);
      expect(groups.map((g) => g.name)).toEqual(['severity']);
    });

    it('stores a provided color', async () => {
      const { asOwner } = await setupProject();
      const created = await asOwner
        .projects({ projectKey: 'MKT' })
        ['label-groups'].post({ name: 'severity', color: '#123456' });
      expect(created.data).toMatchObject({ color: '#123456' });
    });

    it('rejects an empty name', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.projects({ projectKey: 'MKT' })['label-groups'].post({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate name within the project', async () => {
      const { asOwner } = await setupProject();
      const scope = asOwner.projects({ projectKey: 'MKT' })['label-groups'];
      await scope.post({ name: 'severity' });
      const res = await scope.post({ name: 'severity' });
      expect(res.status).toBe(409);
    });
  });

  describe('update label group', () => {
    it('updates the name and reflects it in the view', async () => {
      const { asOwner } = await setupProject();
      const group = (
        await asOwner.projects({ projectKey: 'MKT' })['label-groups'].post({ name: 'severity' })
      ).data!;

      const patched = await asOwner
        .projects({ projectKey: 'MKT' })
        ['label-groups']({ groupId: group.id })
        .patch({ name: 'priority' });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ name: 'priority' });

      const groups = await groupsOf(asOwner);
      expect(groups.find((g) => g.id === group.id)?.name).toBe('priority');
    });

    it('returns 404 for a missing group', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        ['label-groups']({ groupId: 999999 })
        .patch({ name: 'nope' });
      expect(res.status).toBe(404);
    });

    it('rejects an empty name', async () => {
      const { asOwner } = await setupProject();
      const group = (
        await asOwner.projects({ projectKey: 'MKT' })['label-groups'].post({ name: 'severity' })
      ).data!;
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        ['label-groups']({ groupId: group.id })
        .patch({ name: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('delete label group', () => {
    it('removes the group from the view', async () => {
      const { asOwner } = await setupProject();
      const group = (
        await asOwner.projects({ projectKey: 'MKT' })['label-groups'].post({ name: 'severity' })
      ).data!;

      const del = await asOwner
        .projects({ projectKey: 'MKT' })
        ['label-groups']({ groupId: group.id })
        .delete();
      expect(del.status).toBe(204);

      const groups = await groupsOf(asOwner);
      expect(groups.map((g) => g.id)).not.toContain(group.id);
    });

    // Deleting a group ungroups its labels: label.group_id -> SET NULL, so the
    // labels survive with a null group.
    it('ungroups its labels instead of deleting them', async () => {
      const { asOwner } = await setupProject();
      const group = (
        await asOwner.projects({ projectKey: 'MKT' })['label-groups'].post({ name: 'severity' })
      ).data!;
      const label = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          .labels.post({ name: 'urgent', groupId: group.id })
      ).data!;

      await asOwner.projects({ projectKey: 'MKT' })['label-groups']({ groupId: group.id }).delete();

      const labels = await labelsOf(asOwner);
      const survivor = labels.find((l) => l.id === label.id);
      expect(survivor).toBeDefined();
      expect(survivor?.groupId).toBeNull();
    });

    it('returns 204 for a missing group', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        ['label-groups']({ groupId: 999999 })
        .delete();
      expect(res.status).toBe(204);
    });
  });

  // A label is addressed as /projects/:projectKey/labels/:labelId and a group as
  // /projects/:projectKey/label-groups/:groupId. The permission guard runs on
  // :projectKey, so the store must scope the entity to that project — otherwise a
  // request under one project could edit or delete another project's label or
  // group by passing its id. delete has no existence check (always 204), so the
  // isolation is asserted by the foreign entity surviving, not by the status.
  describe('cross-project isolation', () => {
    async function twoProjects() {
      const { asOwner: api } = await setupProject();
      await api.projects.post({ key: 'OPS', name: 'Operations' });
      const label = (await api.projects({ projectKey: 'OPS' }).labels.post({ name: 'urgent' }))
        .data!;
      const group = (
        await api.projects({ projectKey: 'OPS' })['label-groups'].post({ name: 'severity' })
      ).data!;
      return { api, label, group };
    }

    it('does not patch a label from another project', async () => {
      const { api, label } = await twoProjects();
      const res = await api
        .projects({ projectKey: 'MKT' })
        .labels({ labelId: label.id })
        .patch({ name: 'hijacked' });
      expect(res.status).toBe(404);

      const ops = await labelsOf(api, 'OPS');
      expect(ops.find((l) => l.id === label.id)?.name).toBe('urgent');
    });

    it('does not delete a label from another project', async () => {
      const { api, label } = await twoProjects();
      await api.projects({ projectKey: 'MKT' }).labels({ labelId: label.id }).delete();

      const ops = await labelsOf(api, 'OPS');
      expect(ops.some((l) => l.id === label.id)).toBe(true);
    });

    it('does not patch a label group from another project', async () => {
      const { api, group } = await twoProjects();
      const res = await api
        .projects({ projectKey: 'MKT' })
        ['label-groups']({ groupId: group.id })
        .patch({ name: 'hijacked' });
      expect(res.status).toBe(404);

      const ops = await groupsOf(api, 'OPS');
      expect(ops.find((g) => g.id === group.id)?.name).toBe('severity');
    });

    it('does not delete a label group from another project', async () => {
      const { api, group } = await twoProjects();
      await api.projects({ projectKey: 'MKT' })['label-groups']({ groupId: group.id }).delete();

      const ops = await groupsOf(api, 'OPS');
      expect(ops.some((g) => g.id === group.id)).toBe(true);
    });
  });

  describe('access', () => {
    it('returns 404 for an unknown project', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.projects({ projectKey: 'NOPE' }).labels.post({ name: 'urgent' });
      expect(res.status).toBe(404);
    });

    it('denies a non-member on every label route', async () => {
      const { asOwner } = await setupProject();
      const label = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'urgent' }))
        .data!;
      const group = (
        await asOwner.projects({ projectKey: 'MKT' })['label-groups'].post({ name: 'severity' })
      ).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);
      const scope = outsider.projects({ projectKey: 'MKT' });

      // Guard-thrown 403 is not in Treaty's inferred error-status union, so assert
      // the top-level HTTP status rather than error.status.
      expect((await scope.labels.post({ name: 'x' })).status).toBe(403);
      expect((await scope.labels({ labelId: label.id }).patch({ name: 'x' })).status).toBe(403);
      expect((await scope.labels({ labelId: label.id }).delete()).status).toBe(403);
      expect((await scope['label-groups'].post({ name: 'x' })).status).toBe(403);
      expect((await scope['label-groups']({ groupId: group.id }).patch({ name: 'x' })).status).toBe(
        403,
      );
      expect((await scope['label-groups']({ groupId: group.id }).delete()).status).toBe(403);
    });
  });
});
