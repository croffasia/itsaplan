import { describe, it, expect, beforeEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db, projectView } from '@repo/db';
import { deleteAccount } from '#shared/account-deletion';
import { app, authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createRole } from '#tests/helpers/roles';

type Client = ReturnType<typeof authedApi>;

// A member whose role has these views permissions, none of the others for views.
async function addMemberWithViews(
  asOwner: Client,
  views: { read?: boolean; edit?: boolean },
): Promise<{ api: Client; userId: string }> {
  const user = await signUpTestUser();
  const role = await createRole(asOwner, 'MKT', {
    name: `Views ${user.userId}`,
    permissions: {
      views: { read: !!views.read, create: false, edit: !!views.edit, delete: false },
    },
  });
  const invite = await asOwner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member' });
  const api = authedApi(user.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  await asOwner
    .projects({ projectKey: 'MKT' })
    .members({ userId: user.userId })
    .patch({ role: 'member', roleId: role.data!.id });
  return { api, userId: user.userId };
}

// A member whose role reads the project's views and may not create, edit or delete them.
const addViewReader = (asOwner: Client) => addMemberWithViews(asOwner, { read: true });

async function setupOwnerProject() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  const project = await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
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
      await createProject(asOwner, { key: 'OPS', name: 'Operations' });
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

  describe('favorites', () => {
    it('marks a view favorite for the caller and clears it again', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'V' })).data!.id;
      expect((await asOwner.projects({ projectKey: 'MKT' }).views.get()).data?.[0]).toMatchObject({
        favorite: false,
      });

      const added = await asOwner.views({ viewId: id }).favorite.put();
      expect(added.status).toBe(204);
      expect((await asOwner.projects({ projectKey: 'MKT' }).views.get()).data?.[0]).toMatchObject({
        favorite: true,
      });
      expect(await asOwner.views({ viewId: id }).patch({})).toMatchObject({
        data: { favorite: true },
      });

      const removed = await asOwner.views({ viewId: id }).favorite.delete();
      expect(removed.status).toBe(204);
      expect((await asOwner.projects({ projectKey: 'MKT' }).views.get()).data?.[0]).toMatchObject({
        favorite: false,
      });
    });

    it('keeps one row when the same view is favorited twice', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'V' })).data!.id;

      await asOwner.views({ viewId: id }).favorite.put();
      const again = await asOwner.views({ viewId: id }).favorite.put();
      expect(again.status).toBe(204);

      await asOwner.views({ viewId: id }).favorite.delete();
      expect((await asOwner.projects({ projectKey: 'MKT' }).views.get()).data?.[0]).toMatchObject({
        favorite: false,
      });
    });

    it('unfavoriting a view that is not a favorite succeeds', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'V' })).data!.id;

      const res = await asOwner.views({ viewId: id }).favorite.delete();
      expect(res.status).toBe(204);
    });

    it('is personal: another member does not see the owner favorite', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'V' })).data!.id;
      await asOwner.views({ viewId: id }).favorite.put();

      const member = await signUpTestUser();
      const invite = await asOwner
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: member.email, role: 'member' });
      const asMember = authedApi(member.cookie);
      await asMember.invites({ token: invite.data!.token }).accept.post();

      expect((await asMember.projects({ projectKey: 'MKT' }).views.get()).data?.[0]).toMatchObject({
        favorite: false,
      });
      expect((await asOwner.projects({ projectKey: 'MKT' }).views.get()).data?.[0]).toMatchObject({
        favorite: true,
      });
    });

    it('returns 404 for a missing view and 403 for a non-member', async () => {
      const { asOwner } = await setupOwnerProject();
      const id = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'V' })).data!.id;

      const missing = await asOwner.views({ viewId: 999999 }).favorite.put();
      expect(missing.status).toBe(404);

      const outsider = authedApi((await signUpTestUser()).cookie);
      expect((await outsider.views({ viewId: id }).favorite.put()).status).toBe(403);
      expect((await outsider.views({ viewId: id }).favorite.delete()).status).toBe(403);
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
      const createPrivate = await outsider
        .projects({ projectKey: 'MKT' })
        .views.post({ name: 'Intruder', isPrivate: true });
      expect(createPrivate.status).toBe(403);

      const patch = await outsider.views({ viewId }).patch({ name: 'Hacked' });
      expect(patch.status).toBe(403);

      const reorder = await outsider
        .projects({ projectKey: 'MKT' })
        .views.reorder.put({ orderedIds: [viewId] });
      expect(reorder.status).toBe(403);

      expect((await outsider.views({ viewId }).publish.post()).status).toBe(403);

      const del = await outsider.views({ viewId }).delete();
      expect(del.status).toBe(403);
    });
  });

  describe('private views', () => {
    it('lets a member who only reads views create, edit, favorite and delete a private one', async () => {
      const { asOwner } = await setupOwnerProject();
      const member = await addViewReader(asOwner);
      const scope = member.api.projects({ projectKey: 'MKT' }).views;

      expect((await scope.post({ name: 'Shared' })).status).toBe(403);

      const created = await scope.post({ name: 'Mine', isPrivate: true });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ name: 'Mine', isPrivate: true, favorite: false });
      const viewId = created.data!.id;

      expect(
        (await member.api.views({ viewId }).patch({ name: 'Mine, renamed' })).data,
      ).toMatchObject({ name: 'Mine, renamed', isPrivate: true });
      expect((await member.api.views({ viewId }).favorite.put()).status).toBe(204);
      expect((await scope.get()).data).toMatchObject([{ id: viewId, favorite: true }]);
      expect((await member.api.views({ viewId }).favorite.delete()).status).toBe(204);
      expect((await member.api.views({ viewId }).delete()).status).toBe(204);
      expect((await scope.get()).data).toEqual([]);
    });

    it('hides a private view from another member and from an owner, as not found', async () => {
      const { asOwner } = await setupOwnerProject();
      const member = await addViewReader(asOwner);
      const other = await addViewReader(asOwner);
      const viewId = (
        await member.api
          .projects({ projectKey: 'MKT' })
          .views.post({ name: 'Mine', isPrivate: true })
      ).data!.id;

      for (const api of [asOwner, other.api]) {
        expect((await api.projects({ projectKey: 'MKT' }).views.get()).data).toEqual([]);
        expect((await api.views({ viewId }).patch({ name: 'Taken' })).status).toBe(404);
        expect((await api.views({ viewId }).favorite.put()).status).toBe(404);
        expect((await api.views({ viewId }).favorite.delete()).status).toBe(404);
        expect((await api.views({ viewId }).share.post()).status).toBe(404);
        expect((await api.views({ viewId }).share.delete()).status).toBe(404);
        expect((await api.views({ viewId }).publish.post()).status).toBe(404);
        expect((await api.views({ viewId }).delete()).status).toBe(404);
      }
      expect((await member.api.projects({ projectKey: 'MKT' }).views.get()).data).toMatchObject([
        { id: viewId, name: 'Mine' },
      ]);
    });

    it('makes a project view when isPrivate is left out', async () => {
      const { asOwner } = await setupOwnerProject();
      const member = await addViewReader(asOwner);
      const created = await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' });
      expect(created.data).toMatchObject({ isPrivate: false });
      expect((await member.api.projects({ projectKey: 'MKT' }).views.get()).data).toMatchObject([
        { name: 'Board', isPrivate: false },
      ]);
    });

    it("keeps a view private or the project's through an update", async () => {
      const { asOwner } = await setupOwnerProject();
      const member = await addViewReader(asOwner);
      const shared = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' }))
        .data!.id;
      const mine = (
        await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Mine', isPrivate: true })
      ).data!.id;

      // isPrivate is not part of the update body, so it is dropped before the handler.
      const patch = (viewId: number) =>
        asOwner.views({ viewId }).patch({ isPrivate: true } as { name?: string });
      await patch(shared);
      await asOwner.views({ viewId: mine }).patch({ isPrivate: false } as { name?: string });
      await patch(mine);

      expect((await member.api.projects({ projectKey: 'MKT' }).views.get()).data).toMatchObject([
        { id: shared, isPrivate: false },
      ]);
      expect((await asOwner.projects({ projectKey: 'MKT' }).views.get()).data).toMatchObject([
        { id: shared, isPrivate: false },
        { id: mine, isPrivate: true },
      ]);
    });

    it("publishes a private view at the end of the project's order, and only once", async () => {
      const { asOwner } = await setupOwnerProject();
      const member = await addViewReader(asOwner);
      const scope = asOwner.projects({ projectKey: 'MKT' }).views;
      const mine = (await scope.post({ name: 'Mine', isPrivate: true })).data!.id;
      const board = (await scope.post({ name: 'Board' })).data!.id;
      await asOwner.views({ viewId: mine }).favorite.put();

      const published = await asOwner.views({ viewId: mine }).publish.post();
      expect(published.status).toBe(200);
      expect(published.data).toMatchObject({ id: mine, isPrivate: false, favorite: true });
      expect((await member.api.projects({ projectKey: 'MKT' }).views.get()).data).toMatchObject([
        { id: board },
        { id: mine, name: 'Mine', isPrivate: false, favorite: false },
      ]);

      expect((await asOwner.views({ viewId: mine }).publish.post()).status).toBe(400);
      expect((await asOwner.views({ viewId: board }).publish.post()).status).toBe(400);
    });

    it('refuses to publish for a member who may not create views, and for a non-member', async () => {
      const { asOwner } = await setupOwnerProject();
      const member = await addViewReader(asOwner);
      const mine = (
        await member.api
          .projects({ projectKey: 'MKT' })
          .views.post({ name: 'Mine', isPrivate: true })
      ).data!.id;
      const outsider = authedApi((await signUpTestUser()).cookie);

      expect((await member.api.views({ viewId: mine }).publish.post()).status).toBe(403);
      expect((await outsider.views({ viewId: mine }).publish.post()).status).toBe(404);
      expect((await member.api.projects({ projectKey: 'MKT' }).views.get()).data).toMatchObject([
        { id: mine, isPrivate: true },
      ]);
    });

    it("lists the project's views first and private ones after, in their own order", async () => {
      const { asOwner } = await setupOwnerProject();
      const scope = asOwner.projects({ projectKey: 'MKT' }).views;
      const mine = (await scope.post({ name: 'Mine', isPrivate: true })).data!.id;
      const a = (await scope.post({ name: 'A' })).data!.id;
      const b = (await scope.post({ name: 'B' })).data!.id;

      expect((await scope.get()).data?.map((v) => v.id)).toEqual([a, b, mine]);

      const reordered = await scope.reorder.put({ orderedIds: [mine, b, a] });
      expect(reordered.data?.map((v) => v.id)).toEqual([b, a, mine]);
    });

    it('refuses the reorder route to a member who does not read views, and leaks no share link', async () => {
      const { asOwner } = await setupOwnerProject();
      const shared = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' }))
        .data!.id;
      const { data: link } = await asOwner.views({ viewId: shared }).share.post();
      for (const role of [{ read: false }, { read: false, edit: true }]) {
        const member = await addMemberWithViews(asOwner, role);
        for (const orderedIds of [[-1], [shared]]) {
          const res = await member.api
            .projects({ projectKey: 'MKT' })
            .views.reorder.put({ orderedIds });
          expect(res.status).toBe(403);
          expect(JSON.stringify(res.error?.value ?? null)).not.toContain(link!.token);
        }
      }
    });

    it('lets anyone reorder their own private views, and only a views edit the project order', async () => {
      const { asOwner } = await setupOwnerProject();
      const member = await addViewReader(asOwner);
      const board = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' }))
        .data!.id;
      const theirs = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          .views.post({ name: 'Theirs', isPrivate: true })
      ).data!.id;
      const scope = member.api.projects({ projectKey: 'MKT' }).views;
      const first = (await scope.post({ name: 'First', isPrivate: true })).data!.id;
      const second = (await scope.post({ name: 'Second', isPrivate: true })).data!.id;

      const reordered = await scope.reorder.put({ orderedIds: [second, first] });
      expect(reordered.status).toBe(200);
      expect(reordered.data?.map((v) => v.id)).toEqual([board, second, first]);

      expect((await scope.reorder.put({ orderedIds: [board, second] })).status).toBe(403);
      // Someone else's private view is not moved, even through its id.
      await scope.reorder.put({ orderedIds: [theirs, first, second] });
      expect((await asOwner.projects({ projectKey: 'MKT' }).views.get()).data).toMatchObject([
        { id: board },
        { id: theirs, position: 1 },
      ]);
    });

    it('has no share link: sharing a private view is not found, even for its owner', async () => {
      const { asOwner } = await setupOwnerProject();
      const viewId = (
        await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Mine', isPrivate: true })
      ).data!.id;
      expect((await asOwner.views({ viewId }).share.post()).status).toBe(404);
      expect((await asOwner.projects({ projectKey: 'MKT' }).views.get()).data).toMatchObject([
        { id: viewId, shareToken: null },
      ]);
    });

    it('serves neither the page, an issue nor the calendar feed of a private view that carries a token', async () => {
      const { asOwner } = await setupOwnerProject();
      const viewId = (
        await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Mine', isPrivate: true })
      ).data!.id;
      const board = await asOwner.projects({ projectKey: 'MKT' }).get();
      const issueId = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          .issues.post({ columnId: board.data!.columns[0].id, title: 'Shared thing' })
      ).data!.id;
      const token = crypto.randomUUID();
      await db.update(projectView).set({ shareToken: token }).where(eq(projectView.id, viewId));
      for (const path of [
        `/share/view/${token}`,
        `/share/view/${token}/issues/${issueId}`,
        `/share/view/${token}/calendar.ics`,
      ]) {
        const res = await app.handle(new Request(`http://localhost${path}`));
        expect(res.status).toBe(404);
      }
    });

    it('leaves private views behind when the project is copied', async () => {
      const { asOwner } = await setupOwnerProject();
      const scope = asOwner.projects({ projectKey: 'MKT' }).views;
      await scope.post({ name: 'Board' });
      await scope.post({ name: 'Mine', isPrivate: true });

      const copied = await asOwner.projects({ projectKey: 'MKT' }).copy.post({
        key: 'DST',
        name: 'Destination',
      });
      expect(copied.status).toBe(201);
      expect((await asOwner.projects({ projectKey: 'DST' }).views.get()).data).toMatchObject([
        { name: 'Board', isPrivate: false },
      ]);
    });

    it("deletes a deleted account's private views and keeps the project's", async () => {
      const { asOwner } = await setupOwnerProject();
      const member = await addViewReader(asOwner);
      await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' });
      const mine = (
        await member.api
          .projects({ projectKey: 'MKT' })
          .views.post({ name: 'Mine', isPrivate: true })
      ).data!.id;

      await deleteAccount(member.userId);

      // No route shows someone else's private view, so its row is read directly.
      expect(await db.select().from(projectView).where(eq(projectView.id, mine))).toEqual([]);
      const left = await asOwner.projects({ projectKey: 'MKT' }).views.get();
      expect(left.data!.map((v) => v.name)).toEqual(['Board']);
    });

    it('refuses a private view without an owner at the database', async () => {
      const { projectId } = await setupOwnerProject();
      await expect(
        db.insert(projectView).values({ projectId, name: 'Orphan', isPrivate: true }).execute(),
      ).rejects.toThrow();
    });
  });
});
