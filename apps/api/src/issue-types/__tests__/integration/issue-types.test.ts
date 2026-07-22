import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// Issue types belong to one project. There is no GET /issue-types route — a type
// is read back through the project view (GET /projects/:projectKey), whose
// `issueTypes` field is listIssueTypes() ordered by position. A new project seeds
// no types, so the list starts empty. Names are unique within a project (a UNIQUE
// (project_id, name) constraint → 409 on a duplicate).

async function setupProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  return { asOwner };
}

// The project's issue types in position order.
async function typesOf(client: Api, projectKey = 'MKT') {
  const view = await client.projects({ projectKey }).get();
  return view.data!.issueTypes;
}

describe('issue-types', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create', () => {
    it('creates a type with defaults and lists it in the view', async () => {
      const { asOwner } = await setupProject();

      const created = await asOwner.projects({ projectKey: 'MKT' })['issue-types'].post({
        name: 'Bug',
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        name: 'Bug',
        icon: '',
        color: '#6b7280',
        isDefault: false,
        // The project is seeded with a default "Task" type at position 0, so the
        // first user-created type lands at position 1.
        position: 1,
      });
      expect(typeof created.data?.id).toBe('number');

      const types = await typesOf(asOwner);
      expect(types.map((t) => t.name)).toEqual(['Task', 'Bug']);
    });

    it('stores provided icon, color, and isDefault', async () => {
      const { asOwner } = await setupProject();
      const created = await asOwner.projects({ projectKey: 'MKT' })['issue-types'].post({
        name: 'Story',
        icon: 'book',
        color: '#123456',
        isDefault: true,
      });
      expect(created.data).toMatchObject({
        name: 'Story',
        icon: 'book',
        color: '#123456',
        isDefault: true,
      });
    });

    it('assigns increasing positions in creation order', async () => {
      const { asOwner } = await setupProject();
      const scope = asOwner.projects({ projectKey: 'MKT' })['issue-types'];
      const first = (await scope.post({ name: 'Bug' })).data!;
      const second = (await scope.post({ name: 'Story' })).data!;
      // Positions continue after the seeded default "Task" at position 0.
      expect(first.position).toBe(1);
      expect(second.position).toBe(2);

      const types = await typesOf(asOwner);
      expect(types.map((t) => t.name)).toEqual(['Task', 'Bug', 'Story']);
    });

    it('rejects an empty name', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.projects({ projectKey: 'MKT' })['issue-types'].post({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate name within the project', async () => {
      const { asOwner } = await setupProject();
      const scope = asOwner.projects({ projectKey: 'MKT' })['issue-types'];
      await scope.post({ name: 'Bug' });
      const res = await scope.post({ name: 'Bug' });
      expect(res.status).toBe(409);
    });

    it('allows the same name in a different project', async () => {
      const { asOwner } = await setupProject();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      await asOwner.projects({ projectKey: 'MKT' })['issue-types'].post({ name: 'Bug' });
      const res = await asOwner
        .projects({ projectKey: 'OPS' })
        ['issue-types'].post({ name: 'Bug' });
      expect(res.status).toBe(201);
    });
  });

  describe('update', () => {
    it('updates the name and reflects it in the view', async () => {
      const { asOwner } = await setupProject();
      const type = (
        await asOwner.projects({ projectKey: 'MKT' })['issue-types'].post({ name: 'Bug' })
      ).data!;

      const patched = await asOwner
        .projects({ projectKey: 'MKT' })
        ['issue-types']({ typeId: type.id })
        .patch({ name: 'Defect' });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ name: 'Defect' });

      const types = await typesOf(asOwner);
      expect(types.find((t) => t.id === type.id)?.name).toBe('Defect');
    });

    it('updates color and isDefault', async () => {
      const { asOwner } = await setupProject();
      const type = (
        await asOwner.projects({ projectKey: 'MKT' })['issue-types'].post({ name: 'Bug' })
      ).data!;

      const patched = await asOwner
        .projects({ projectKey: 'MKT' })
        ['issue-types']({ typeId: type.id })
        .patch({ color: '#abcdef', isDefault: true });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ color: '#abcdef', isDefault: true });
    });

    it('returns the current type for an empty patch', async () => {
      const { asOwner } = await setupProject();
      const type = (
        await asOwner.projects({ projectKey: 'MKT' })['issue-types'].post({ name: 'Bug' })
      ).data!;

      const patched = await asOwner
        .projects({ projectKey: 'MKT' })
        ['issue-types']({ typeId: type.id })
        .patch({});
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ id: type.id, name: 'Bug' });
    });

    it('returns 404 for a missing type', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        ['issue-types']({ typeId: 999999 })
        .patch({ name: 'Nope' });
      expect(res.status).toBe(404);
    });

    it('rejects an empty name', async () => {
      const { asOwner } = await setupProject();
      const type = (
        await asOwner.projects({ projectKey: 'MKT' })['issue-types'].post({ name: 'Bug' })
      ).data!;
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        ['issue-types']({ typeId: type.id })
        .patch({ name: '' });
      expect(res.status).toBe(400);
    });

    it("rejects renaming onto another type's name", async () => {
      const { asOwner } = await setupProject();
      const scope = asOwner.projects({ projectKey: 'MKT' })['issue-types'];
      await scope.post({ name: 'Bug' });
      const story = (await scope.post({ name: 'Story' })).data!;

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        ['issue-types']({ typeId: story.id })
        .patch({ name: 'Bug' });
      expect(res.status).toBe(409);
    });
  });

  describe('delete', () => {
    it('removes the type from the view', async () => {
      const { asOwner } = await setupProject();
      const type = (
        await asOwner.projects({ projectKey: 'MKT' })['issue-types'].post({ name: 'Bug' })
      ).data!;

      const del = await asOwner
        .projects({ projectKey: 'MKT' })
        ['issue-types']({ typeId: type.id })
        .delete();
      expect(del.status).toBe(204);

      const types = await typesOf(asOwner);
      expect(types.map((t) => t.id)).not.toContain(type.id);
    });

    // The store deletes by (id, projectId) with no existence check, so a missing
    // id is a no-op that still returns 204.
    it('returns 204 for a missing type', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        ['issue-types']({ typeId: 999999 })
        .delete();
      expect(res.status).toBe(204);
    });
  });

  // A type is addressed as /projects/:projectKey/issue-types/:typeId. The
  // permission guard runs on :projectKey, so the store must scope the type to that
  // project — otherwise a request under one project could edit or delete another
  // project's type by passing its id. delete has no existence check (always 204),
  // so the isolation is asserted by the foreign type surviving, not by the status.
  describe('cross-project isolation', () => {
    async function twoProjects() {
      const { asOwner: api } = await setupProject();
      await api.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = (
        await api.projects({ projectKey: 'OPS' })['issue-types'].post({ name: 'Bug' })
      ).data!;
      return { api, foreign };
    }

    it('does not patch a type from another project', async () => {
      const { api, foreign } = await twoProjects();
      const res = await api
        .projects({ projectKey: 'MKT' })
        ['issue-types']({ typeId: foreign.id })
        .patch({ name: 'Hijacked' });
      expect(res.status).toBe(404);

      const ops = await typesOf(api, 'OPS');
      expect(ops.find((t) => t.id === foreign.id)?.name).toBe('Bug');
    });

    it('does not delete a type from another project', async () => {
      const { api, foreign } = await twoProjects();
      await api.projects({ projectKey: 'MKT' })['issue-types']({ typeId: foreign.id }).delete();

      const ops = await typesOf(api, 'OPS');
      expect(ops.some((t) => t.id === foreign.id)).toBe(true);
    });
  });

  describe('access', () => {
    it('returns 404 for an unknown project', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.projects({ projectKey: 'NOPE' })['issue-types'].post({
        name: 'Bug',
      });
      expect(res.status).toBe(404);
    });

    it('denies a non-member on every issue-type route', async () => {
      const { asOwner } = await setupProject();
      const type = (
        await asOwner.projects({ projectKey: 'MKT' })['issue-types'].post({ name: 'Bug' })
      ).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);
      const scope = outsider.projects({ projectKey: 'MKT' });

      // Guard-thrown 403 is not in Treaty's inferred error-status union, so assert
      // the top-level HTTP status rather than error.status.
      expect((await scope['issue-types'].post({ name: 'X' })).status).toBe(403);
      expect((await scope['issue-types']({ typeId: type.id }).patch({ name: 'X' })).status).toBe(
        403,
      );
      expect((await scope['issue-types']({ typeId: type.id }).delete()).status).toBe(403);
    });
  });
});
