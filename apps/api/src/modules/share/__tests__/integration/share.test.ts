import { describe, it, expect, beforeEach } from 'bun:test';
import { api, authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createRole } from '#tests/helpers/roles';
import { db, issue as issueTable, projectDocument, projectView } from '@repo/db';
import { eq } from 'drizzle-orm';
import { sweepExpiredShares } from '#modules/share/service';

// Public read-only sharing. Enabling sharing on an issue, a saved view or a document sets an
// unguessable token; the /share/* GET routes then return a self-contained bundle
// (project scaffold + entity) with no session. Revoking clears the token, so the
// link stops working. The enable/revoke routes are gated by the same permission as
// editing the entity (work_items edit / views edit).

async function setup() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const board = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = board.data!.columns[0].id;
  const issue = await asOwner
    .projects({ projectKey: 'MKT' })
    .issues.post({ columnId, title: 'Shared thing' });
  return { asOwner, ownerId: owner.userId, issueId: issue.data!.id, columnId };
}

describe('share', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('issue sharing', () => {
    it('enables a link, serves the public bundle, then revokes it', async () => {
      const { asOwner, issueId } = await setup();

      const enabled = await asOwner.issues({ issueId }).share.post();
      expect(enabled.status).toBe(200);
      const token = enabled.data!.token;
      expect(typeof token).toBe('string');

      const shared = await api.share.issue({ token }).get();
      expect(shared.status).toBe(200);
      expect(shared.data.issue).toMatchObject({ id: issueId, title: 'Shared thing' });
      expect(shared.data.project.project).toMatchObject({ key: 'MKT' });
      expect(Array.isArray(shared.data.feed)).toBe(true);

      const revoked = await asOwner.issues({ issueId }).share.delete();
      expect(revoked.status).toBe(204);

      const gone = await api.share.issue({ token }).get();
      expect(gone.status).toBe(404);
    });

    it('is idempotent: enabling twice keeps the same token', async () => {
      const { asOwner, issueId } = await setup();
      const first = await asOwner.issues({ issueId }).share.post();
      const second = await asOwner.issues({ issueId }).share.post();
      expect(second.data!.token).toBe(first.data!.token);
    });

    it('strips member emails from the public scaffold', async () => {
      const { asOwner, issueId } = await setup();
      const token = (await asOwner.issues({ issueId }).share.post({ extended: true })).data!.token;
      const shared = await api.share.issue({ token }).get();
      expect(shared.data.project.assignees.length).toBeGreaterThan(0);
      for (const a of shared.data.project.assignees) {
        expect((a as Record<string, unknown>).email).toBeUndefined();
      }
    });

    // The same choice a shared board carries: a new link keeps the issue's own
    // words and hides the people, labels, custom fields and activity around it.
    it('hides the people and activity by default, and exposes them when extended', async () => {
      const { asOwner, ownerId, issueId } = await setup();
      const label = await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'urgent' });
      await asOwner
        .issues({ issueId })
        .patch({ assigneeUserId: ownerId, labelIds: [label.data!.id] });

      // A cycle that starts today, since a completed one takes no new issues.
      const start = new Date();
      const end = new Date(start.getTime() + 13 * 24 * 60 * 60 * 1000);
      const cycle = await asOwner.projects({ projectKey: 'MKT' }).cycles.post({
        name: 'Sprint 1',
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      });
      await asOwner.issues({ issueId }).patch({ cycleId: cycle.data!.id });

      const token = (await asOwner.issues({ issueId }).share.post()).data!.token;
      const plain = await api.share.issue({ token }).get();
      expect(plain.data.issue).toMatchObject({
        title: 'Shared thing',
        assigneeUserId: null,
        labelIds: [],
        cycle: null,
      });
      expect(plain.data.feed).toEqual([]);
      expect(plain.data.project.labels).toEqual([]);

      const same = (await asOwner.issues({ issueId }).share.post({ extended: true })).data!.token;
      expect(same).toBe(token);
      const full = await api.share.issue({ token }).get();
      expect(full.data.issue.assigneeUserId).not.toBeNull();
      expect(full.data.issue.labelIds).toHaveLength(1);
      expect(full.data.issue.cycle).toMatchObject({ name: 'Sprint 1' });
      expect(full.data.feed.length).toBeGreaterThan(0);
    });

    it('starts a re-created link without the full issue', async () => {
      const { asOwner, issueId } = await setup();
      await asOwner.issues({ issueId }).share.post({ extended: true });
      await asOwner.issues({ issueId }).share.delete();
      const token = (await asOwner.issues({ issueId }).share.post()).data!.token;
      const shared = await api.share.issue({ token }).get();
      expect(shared.data.issue.shareExtended).toBe(false);
    });

    it('leaves a live link as it stands when the request omits the choice', async () => {
      const { asOwner, issueId } = await setup();
      await asOwner.issues({ issueId }).share.post({ extended: true });
      const token = (await asOwner.issues({ issueId }).share.post()).data!.token;
      const shared = await api.share.issue({ token }).get();
      expect(shared.data.issue.shareExtended).toBe(true);
    });

    it('carries the issue relations', async () => {
      const { asOwner, issueId, columnId } = await setup();
      const subtask = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId, title: 'Step one', parentId: issueId });
      const token = (await asOwner.issues({ issueId }).share.post()).data!.token;

      const shared = await api.share.issue({ token }).get();
      expect(shared.data.issue.subtasks.map((s: { id: number }) => s.id)).toEqual([
        subtask.data!.id,
      ]);
      expect(shared.data.issue.links).toEqual([]);
      expect(shared.data.issue.parent).toBeNull();
    });

    it('rejects a malformed token', async () => {
      const res = await api.share.issue({ token: 'not-a-uuid' }).get();
      expect(res.status).toBe(400);
    });

    it('404s an unknown token', async () => {
      const res = await api.share.issue({ token: '00000000-0000-0000-0000-000000000000' }).get();
      expect(res.status).toBe(404);
    });

    it('denies a non-member enabling sharing', async () => {
      const { issueId } = await setup();
      const outsider = authedApi((await signUpTestUser()).cookie);
      const res = await outsider.issues({ issueId }).share.post();
      expect(res.status).toBe(403);
    });

    it('404s enabling a missing issue', async () => {
      const { asOwner } = await setup();
      const res = await asOwner.issues({ issueId: 999999 }).share.post();
      expect(res.status).toBe(404);
    });
  });

  describe('view sharing', () => {
    async function sharedView() {
      const { asOwner, issueId } = await setup();
      const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' });
      const viewId = view.data!.id;
      const token = (await asOwner.views({ viewId }).share.post()).data!.token;
      return { asOwner, viewId, token, issueId };
    }

    it('serves the public view bundle with its issues', async () => {
      const { token, issueId } = await sharedView();
      const shared = await api.share.view({ token }).get();
      expect(shared.status).toBe(200);
      expect(shared.data.view).toMatchObject({ name: 'Board' });
      expect(shared.data.issues.map((i: { id: number }) => i.id)).toContain(issueId);
    });

    // A view's filters are stored as an uninspected jsonb blob, so a condition can
    // reach the server-side engine without the values every value operator reads.
    it('serves a view whose filter condition carries no values', async () => {
      const { asOwner, viewId, token, issueId } = await sharedView();
      const patched = await asOwner
        .views({ viewId })
        .patch({ filters: { conditions: [{ field: 'status', op: 'is' }] } });
      expect(patched.status).toBe(200);

      const shared = await api.share.view({ token }).get();
      expect(shared.status).toBe(200);
      expect(shared.data.issues.map((i: { id: number }) => i.id)).toContain(issueId);
    });

    it('opens an issue from a shared board under the same token', async () => {
      const { token, issueId } = await sharedView();
      const res = await api.share.view({ token }).issues({ issueId }).get();
      expect(res.status).toBe(200);
      expect(res.data.issue).toMatchObject({ id: issueId });
    });

    it('does not leak per-issue tokens through the board bundle', async () => {
      const { asOwner, token, issueId } = await sharedView();
      // Share the issue itself too; the board bundle must still hide its token.
      await asOwner.issues({ issueId }).share.post();
      const shared = await api.share.view({ token }).get();
      for (const i of shared.data.issues) {
        expect((i as { shareToken: unknown }).shareToken).toBeNull();
      }
    });

    it('excludes issues the view filter hides, and refuses to open them by id', async () => {
      const { asOwner, issueId } = await setup();
      const board = await asOwner.projects({ projectKey: 'MKT' }).get();
      const shownColumn = board.data!.columns[0].id;
      const hiddenColumn = board.data!.columns[1].id;
      // A second issue in another column, which the view's status filter excludes.
      const hidden = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: hiddenColumn, title: 'Hidden' });
      const hiddenId = hidden.data!.id;
      const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({
        name: 'Filtered',
        filters: { conditions: [{ id: 'c1', field: 'status', op: 'is', values: [shownColumn] }] },
      });
      const token = (await asOwner.views({ viewId: view.data!.id }).share.post()).data!.token;

      const shared = await api.share.view({ token }).get();
      const ids = shared.data.issues.map((i: { id: number }) => i.id);
      expect(ids).toContain(issueId);
      expect(ids).not.toContain(hiddenId);

      const opened = await api.share.view({ token }).issues({ issueId: hiddenId }).get();
      expect(opened.status).toBe(404);
    });

    it('excludes issues a cycle or initiative filter hides, by id and by status', async () => {
      const { asOwner, issueId, columnId } = await setup();
      const project = asOwner.projects({ projectKey: 'MKT' });
      // Dates around today, so the cycle is the running one.
      const cycle = await project.cycles.post({
        name: 'Sprint 1',
        startDate: '2000-01-01',
        endDate: '2099-01-14',
      });
      const initiative = await project.initiatives.post({ title: 'Q3' });
      await asOwner
        .issues({ issueId })
        .patch({ cycleId: cycle.data!.id, initiativeId: initiative.data!.id });
      const outside = await project.issues.post({ columnId, title: 'Unplanned' });

      for (const condition of [
        { id: 'c1', field: 'cycle', op: 'is' as const, values: [cycle.data!.id] },
        { id: 'c1', field: 'initiative', op: 'is' as const, values: [initiative.data!.id] },
        { id: 'c1', field: 'cycle', op: 'is' as const, values: ['status:active'] },
        {
          id: 'c1',
          field: 'initiative',
          op: 'is' as const,
          values: [`status:${initiative.data!.status}`],
        },
      ]) {
        const view = await project.views.post({
          name: 'Filtered',
          filters: { conditions: [condition] },
        });
        const token = (await asOwner.views({ viewId: view.data!.id }).share.post()).data!.token;

        const shared = await api.share.view({ token }).get();
        const ids = shared.data.issues.map((i: { id: number }) => i.id);
        expect(ids).toContain(issueId);
        expect(ids).not.toContain(outside.data!.id);
      }
    });

    it('leaves relations to issues the view filter hides out of the board and the opened issue', async () => {
      const { asOwner, issueId, columnId } = await setup();
      const board = await asOwner.projects({ projectKey: 'MKT' }).get();
      const hiddenColumn = board.data!.columns[1].id;
      const hidden = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: hiddenColumn, title: 'Hidden' });
      await asOwner
        .issues({ issueId })
        .links.post({ targetIssueId: hidden.data!.id, kind: 'blocks' });
      // A subtask the filter hides must not be counted on its parent's card either.
      await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: hiddenColumn, title: 'Hidden step', parentId: issueId });
      const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({
        name: 'Filtered',
        filters: { conditions: [{ id: 'c1', field: 'status', op: 'is', values: [columnId] }] },
      });
      const token = (await asOwner.views({ viewId: view.data!.id }).share.post()).data!.token;

      const shared = await api.share.view({ token }).get();
      const card = shared.data.issues.find((i: { id: number }) => i.id === issueId);
      expect(card.links).toEqual([]);
      expect(card.subtaskCount).toBe(0);

      const opened = await api.share.view({ token }).issues({ issueId }).get();
      expect(opened.data.issue.links).toEqual([]);
    });

    it('keeps the view filters off the public bundle', async () => {
      const { asOwner } = await setup();
      const view = await asOwner
        .projects({ projectKey: 'MKT' })
        .views.post({ name: 'Board', filters: { conditions: [] } });
      const token = (await asOwner.views({ viewId: view.data!.id }).share.post()).data!.token;

      const shared = await api.share.view({ token }).get();
      expect(shared.data.view.filters).toBeUndefined();
    });

    it('refuses to open an issue from another project via a board token', async () => {
      const { asOwner, token } = await sharedView();
      await createProject(asOwner, { key: 'OPS', name: 'Operations' });
      const opsBoard = await asOwner.projects({ projectKey: 'OPS' }).get();
      const other = await asOwner
        .projects({ projectKey: 'OPS' })
        .issues.post({ columnId: opsBoard.data!.columns[0].id, title: 'Foreign' });
      const res = await api.share.view({ token }).issues({ issueId: other.data!.id }).get();
      expect(res.status).toBe(404);
    });

    it('revokes a view link', async () => {
      const { asOwner, viewId, token } = await sharedView();
      const del = await asOwner.views({ viewId }).share.delete();
      expect(del.status).toBe(204);
      const gone = await api.share.view({ token }).get();
      expect(gone.status).toBe(404);
    });

    // A board link exposes the issues in full only when it is enabled with
    // extended: true. Without it the public payload keeps the issue's own words —
    // title, description, state, type, priority, dates — and drops the people on
    // it, its labels, its custom field values and its activity.
    describe('what a board link exposes', () => {
      async function withAssignedIssue() {
        const { asOwner, ownerId, issueId } = await setup();
        const label = await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'urgent' });
        await asOwner
          .issues({ issueId })
          .patch({ assigneeUserId: ownerId, labelIds: [label.data!.id] });
        const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' });
        return { asOwner, viewId: view.data!.id, issueId };
      }

      it('hides the people, labels and activity by default', async () => {
        const { asOwner, viewId, issueId } = await withAssignedIssue();
        const token = (await asOwner.views({ viewId }).share.post()).data!.token;

        const shared = await api.share.view({ token }).get();
        expect(shared.data.view.extended).toBe(false);
        expect(shared.data.project.assignees).toEqual([]);
        expect(shared.data.project.labels).toEqual([]);
        expect(shared.data.issues[0]).toMatchObject({
          title: 'Shared thing',
          assigneeUserId: null,
          labelIds: [],
          fieldValues: [],
        });

        const opened = await api.share.view({ token }).issues({ issueId }).get();
        expect(opened.data.issue).toMatchObject({ assigneeUserId: null, labelIds: [] });
        expect(opened.data.feed).toEqual([]);
      });

      it('exposes them when the link is extended, keeping the same token', async () => {
        const { asOwner, viewId, issueId } = await withAssignedIssue();
        const first = (await asOwner.views({ viewId }).share.post()).data!.token;
        const second = (await asOwner.views({ viewId }).share.post({ extended: true })).data!.token;
        expect(second).toBe(first);

        const shared = await api.share.view({ token: second }).get();
        expect(shared.data.view.extended).toBe(true);
        expect(shared.data.issues[0].assigneeUserId).not.toBeNull();
        expect(shared.data.issues[0].labelIds).toHaveLength(1);

        const opened = await api.share.view({ token: second }).issues({ issueId }).get();
        expect(opened.data.feed.length).toBeGreaterThan(0);
      });

      it('starts a re-created link without the full issues', async () => {
        const { asOwner, viewId } = await withAssignedIssue();
        await asOwner.views({ viewId }).share.post({ extended: true });
        await asOwner.views({ viewId }).share.delete();
        const token = (await asOwner.views({ viewId }).share.post()).data!.token;
        const shared = await api.share.view({ token }).get();
        expect(shared.data.view.extended).toBe(false);
      });

      it('leaves a live link as it stands when the request omits the choice', async () => {
        const { asOwner, viewId } = await withAssignedIssue();
        await asOwner.views({ viewId }).share.post({ extended: true });
        const token = (await asOwner.views({ viewId }).share.post()).data!.token;
        const shared = await api.share.view({ token }).get();
        expect(shared.data.view.extended).toBe(true);
      });
    });

    it('carries relations and subtask counts on the board issues', async () => {
      const { asOwner, issueId, columnId } = await setup();
      const other = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId, title: 'Blocker' });
      await asOwner
        .issues({ issueId })
        .links.post({ targetIssueId: other.data!.id, kind: 'blocks' });
      const subtask = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId, title: 'Step one', parentId: issueId });
      const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' });
      const token = (await asOwner.views({ viewId: view.data!.id }).share.post()).data!.token;

      const shared = await api.share.view({ token }).get();
      const card = shared.data.issues.find((i: { id: number }) => i.id === issueId);
      expect(card.links).toHaveLength(1);
      expect(card.subtaskCount).toBe(1);

      const opened = await api.share.view({ token }).issues({ issueId }).get();
      expect(opened.data.issue.links).toHaveLength(1);
      expect(opened.data.issue.subtasks.map((s: { id: number }) => s.id)).toEqual([
        subtask.data!.id,
      ]);
      expect(opened.data.issue.parent).toBeNull();
    });

    it('denies a non-member enabling view sharing', async () => {
      const { asOwner } = await setup();
      const viewId = (await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'V' })).data!
        .id;
      const outsider = authedApi((await signUpTestUser()).cookie);
      const res = await outsider.views({ viewId }).share.post();
      expect(res.status).toBe(403);
    });
  });
  // A link can carry an expiry. Past it the link is dead everywhere: the public read
  // 404s, the issue reports itself as not shared, the sweep clears the token, and
  // enabling sharing again hands out a new link instead of reviving the old one.
  describe('link expiry', () => {
    const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

    async function expireIssueShare(issueId: number) {
      await db
        .update(issueTable)
        .set({ shareExpiresAt: new Date(Date.now() - 1000) })
        .where(eq(issueTable.id, issueId));
    }

    it('stores the expiry and reports it on the issue', async () => {
      const { asOwner, issueId } = await setup();
      const expiresAt = inDays(3);
      const enabled = await asOwner.issues({ issueId }).share.post({ expiresAt });
      expect(enabled.status).toBe(200);
      expect(new Date(enabled.data!.expiresAt!).getTime()).toBe(new Date(expiresAt).getTime());

      const read = await asOwner.issues({ issueId }).get();
      expect(read.data!.shareToken).toBe(enabled.data!.token);
      expect(new Date(read.data!.shareExpiresAt!).getTime()).toBe(new Date(expiresAt).getTime());

      const shared = await api.share.issue({ token: enabled.data!.token }).get();
      expect(shared.status).toBe(200);
    });

    it('keeps the expiry when another change omits it, and clears it with null', async () => {
      const { asOwner, issueId } = await setup();
      const first = await asOwner.issues({ issueId }).share.post({ expiresAt: inDays(1) });
      const flipped = await asOwner.issues({ issueId }).share.post({ extended: true });
      expect(flipped.data!.token).toBe(first.data!.token);
      expect(flipped.data!.expiresAt).toEqual(first.data!.expiresAt);

      const never = await asOwner.issues({ issueId }).share.post({ expiresAt: null });
      expect(never.data!.token).toBe(first.data!.token);
      expect(never.data!.expiresAt).toBeNull();
    });

    it('rejects an expiry in the past', async () => {
      const { asOwner, issueId } = await setup();
      const res = await asOwner
        .issues({ issueId })
        .share.post({ expiresAt: new Date(Date.now() - 60_000).toISOString() });
      expect(res.status).toBe(400);
    });

    it('stops serving an expired link and reports the issue as not shared', async () => {
      const { asOwner, issueId } = await setup();
      const { token } = (await asOwner.issues({ issueId }).share.post({ expiresAt: inDays(1) }))
        .data!;
      await expireIssueShare(issueId);

      const gone = await api.share.issue({ token }).get();
      expect(gone.status).toBe(404);

      const read = await asOwner.issues({ issueId }).get();
      expect(read.data!.shareToken).toBeNull();
      expect(read.data!.shareExtended).toBe(false);
      expect(read.data!.shareExpiresAt).toBeNull();
    });

    it('issues a new token when an expired link is shared again', async () => {
      const { asOwner, issueId } = await setup();
      const first = (
        await asOwner.issues({ issueId }).share.post({ extended: true, expiresAt: inDays(1) })
      ).data!;
      await expireIssueShare(issueId);

      const again = (await asOwner.issues({ issueId }).share.post()).data!;
      expect(again.token).not.toBe(first.token);
      expect(again.expiresAt).toBeNull();
      const read = await asOwner.issues({ issueId }).get();
      expect(read.data!.shareExtended).toBe(false);
      expect((await api.share.issue({ token: first.token }).get()).status).toBe(404);
      expect((await api.share.issue({ token: again.token }).get()).status).toBe(200);
    });

    it('the sweep clears expired tokens and leaves live ones', async () => {
      const { asOwner, issueId, columnId } = await setup();
      const other = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId, title: 'Still shared' });
      const otherId = other.data!.id;
      await asOwner.issues({ issueId }).share.post({ expiresAt: inDays(1) });
      const live = (await asOwner.issues({ issueId: otherId }).share.post({ expiresAt: inDays(7) }))
        .data!;
      await expireIssueShare(issueId);

      expect(await sweepExpiredShares()).toBe(1);
      const [row] = await db.select().from(issueTable).where(eq(issueTable.id, issueId));
      expect(row.shareToken).toBeNull();
      expect(row.shareExpiresAt).toBeNull();
      expect((await api.share.issue({ token: live.token }).get()).status).toBe(200);
    });

    it('expires a shared view the same way', async () => {
      const { asOwner } = await setup();
      const view = await asOwner.projects({ projectKey: 'MKT' }).views.post({ name: 'Board' });
      const viewId = view.data!.id;
      const { token } = (await asOwner.views({ viewId }).share.post({ expiresAt: inDays(3) }))
        .data!;
      expect((await api.share.view({ token }).get()).status).toBe(200);

      await db
        .update(projectView)
        .set({ shareExpiresAt: new Date(Date.now() - 1000) })
        .where(eq(projectView.id, viewId));
      expect((await api.share.view({ token }).get()).status).toBe(404);

      const views = await asOwner.projects({ projectKey: 'MKT' }).views.get();
      const listed = views.data!.find((v: { id: number }) => v.id === viewId)!;
      expect(listed.shareToken).toBeNull();

      expect(await sweepExpiredShares()).toBe(1);
    });
  });

  describe('project overview', () => {
    it('lists the live links of a project and revokes the ones the caller may edit', async () => {
      const { asOwner, issueId } = await setup();
      const project = asOwner.projects({ projectKey: 'MKT' });
      const view = (await project.views.post({ name: 'Board' })).data!;
      const doc = (await project.documents.post({ title: 'Guide', content: 'MKT-1' })).data!;
      const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
      await asOwner.issues({ issueId }).share.post({ expiresAt });
      await asOwner.views({ viewId: view.id }).share.post();
      await asOwner.documents({ documentId: doc.id }).share.post({ includeIssues: true });

      const listed = await project.shares.get();
      expect(listed.status).toBe(200);
      expect(listed.data!.issues).toEqual([
        {
          id: issueId,
          sequence: 1,
          title: 'Shared thing',
          extended: false,
          expiresAt: expect.anything(),
        },
      ]);
      expect(listed.data!.views).toEqual([
        { id: view.id, name: 'Board', extended: false, expiresAt: null },
      ]);
      expect(listed.data!.documents).toEqual([
        {
          id: doc.id,
          title: 'Guide',
          includeChildren: false,
          includeIssues: true,
          expiresAt: null,
        },
      ]);
      expect(listed.data!.canRevoke).toEqual({ issues: true, views: true, documents: true });

      const reader = await signUpTestUser();
      const readerRole = await createRole(asOwner, 'MKT', {
        name: 'Reader',
        permissions: { work_items: { read: true } },
      });
      const invite = await project.invites.post({ email: reader.email, role: 'member' });
      const asReader = authedApi(reader.cookie);
      await asReader.invites({ token: invite.data!.token }).accept.post();
      await project
        .members({ userId: reader.userId })
        .patch({ role: 'member', roleId: readerRole.data!.id });
      const seen = await asReader.projects({ projectKey: 'MKT' }).shares.get();
      expect(seen.data!.issues).toHaveLength(1);
      expect(seen.data!.views).toEqual([]);
      expect(seen.data!.documents).toEqual([]);
      expect(seen.data!.canRevoke).toEqual({ issues: false, views: false, documents: false });
      expect((await asReader.projects({ projectKey: 'MKT' }).shares.delete()).data).toEqual({
        revoked: 0,
      });

      expect((await project.shares.delete()).data).toEqual({ revoked: 3 });
      const after = await project.shares.get();
      expect(after.data).toMatchObject({ issues: [], views: [], documents: [] });

      const outsider = authedApi((await signUpTestUser()).cookie);
      expect((await outsider.projects({ projectKey: 'MKT' }).shares.get()).status).toBe(403);
    });
  });

  // A shared page is read without a session, and with includeChildren its subpages too.
  // Its assets load through the token, and only those of the pages the link opens.
  describe('document sharing', () => {
    type Client = ReturnType<typeof authedApi>;
    const documents = (client: Client) => client.projects({ projectKey: 'MKT' }).documents;

    async function page(client: Client, title: string, parentId: number | null = null) {
      return (await documents(client).post({ title, parentId, content: `# ${title}` })).data!;
    }

    // Root > Child > Grandchild, with Parent above Root and Sibling beside it.
    async function tree() {
      const { asOwner } = await setup();
      const parent = await page(asOwner, 'Parent');
      const root = await page(asOwner, 'Root', parent.id);
      const sibling = await page(asOwner, 'Sibling', parent.id);
      const child = await page(asOwner, 'Child', root.id);
      const grandchild = await page(asOwner, 'Grandchild', child.id);
      return { asOwner, parent, root, sibling, child, grandchild };
    }

    const subpage = (token: string, documentId: number) =>
      api.share.document({ token }).documents({ documentId }).get();

    it('enables a link, serves the page, reports it on the document, then revokes it', async () => {
      const { asOwner, root } = await tree();
      const enabled = await asOwner.documents({ documentId: root.id }).share.post();
      expect(enabled.status).toBe(200);
      const { token } = enabled.data!;

      const shared = await api.share.document({ token }).get();
      expect(shared.status).toBe(200);
      expect(shared.data.document).toMatchObject({ id: root.id, title: 'Root', content: '# Root' });
      expect(shared.data.project).toEqual({ name: 'Marketing', key: 'MKT' });
      expect(shared.data.pages).toEqual([
        { id: root.id, parentId: null, title: 'Root', icon: null },
      ]);

      const read = await documents(asOwner)({ documentId: root.id }).get();
      expect(read.data).toMatchObject({ shareToken: token, shareIncludeChildren: false });

      expect((await asOwner.documents({ documentId: root.id }).share.delete()).status).toBe(204);
      expect((await api.share.document({ token }).get()).status).toBe(404);
      const after = await documents(asOwner)({ documentId: root.id }).get();
      expect(after.data!.shareToken).toBeNull();
    });

    it('names the issues of the project the page mentions only when the link shows them', async () => {
      const { asOwner, issueId, columnId } = await setup();
      const issues = asOwner.projects({ projectKey: 'MKT' }).issues;
      const archived = (await issues.post({ columnId, title: 'Old thing' })).data!;
      await db
        .update(issueTable)
        .set({ archivedAt: new Date() })
        .where(eq(issueTable.id, archived.id));
      await createProject(asOwner, { key: 'OPS', name: 'Operations' });
      const content = `See MKT-1, MKT-${archived.sequenceNumber}, MKT-99, OPS-1 and XMKT-1.`;
      const doc = (await documents(asOwner).post({ title: 'Notes', content })).data!;

      const share = asOwner.documents({ documentId: doc.id }).share;
      const { token } = (await share.post()).data!;
      expect((await api.share.document({ token }).get()).data.issues).toEqual([]);

      await share.post({ includeIssues: true });
      const read = await documents(asOwner)({ documentId: doc.id }).get();
      expect(read.data).toMatchObject({ shareIncludeIssues: true, shareIncludeChildren: false });
      const state = { name: expect.any(String), color: expect.any(String) };
      const shared = await api.share.document({ token }).get();
      expect(shared.data.issues).toEqual([
        { id: issueId, sequence: 1, title: 'Shared thing', state },
        { id: archived.id, sequence: archived.sequenceNumber, title: 'Old thing', state },
      ]);

      await asOwner.documents({ documentId: doc.id }).share.delete();
      const again = (await share.post()).data!;
      expect((await api.share.document({ token: again.token }).get()).data.issues).toEqual([]);
    });

    it('opens a named issue through the link, reduced, and nothing else', async () => {
      const { asOwner, issueId, columnId } = await setup();
      const issues = asOwner.projects({ projectKey: 'MKT' }).issues;
      const other = (await issues.post({ columnId, title: 'Not named' })).data!;
      const root = await page(asOwner, 'Root');
      const child = (
        await documents(asOwner).post({ title: 'Child', parentId: root.id, content: 'See MKT-1.' })
      ).data!;
      const share = asOwner.documents({ documentId: root.id }).share;
      const { token } = (await share.post({ includeChildren: true })).data!;
      const open = (id: number) => api.share.document({ token }).issues({ issueId: id }).get();

      expect((await open(issueId)).status).toBe(404);
      await share.post({ includeIssues: true });
      const opened = await open(issueId);
      expect(opened.status).toBe(200);
      expect(opened.data.issue).toMatchObject({
        id: issueId,
        title: 'Shared thing',
        shareToken: null,
      });
      expect(opened.data.issue.labelIds).toEqual([]);
      expect(opened.data.feed).toEqual([]);
      expect((await open(other.id)).status).toBe(404);

      const listed = await asOwner.issues({ issueId }).share.documents.get();
      expect(listed.data).toEqual([{ documentId: root.id, title: 'Root', expiresAt: null }]);
      expect((await asOwner.issues({ issueId: other.id }).share.documents.get()).data).toEqual([]);

      await share.post({ includeChildren: false });
      expect((await open(issueId)).status).toBe(404);
      expect((await asOwner.issues({ issueId }).share.documents.get()).data).toEqual([]);
      expect(child.id).toBeGreaterThan(0);
    });

    it('opens the subpages only when the link includes them, never the parent or a sibling', async () => {
      const { asOwner, parent, root, sibling, child, grandchild } = await tree();
      const { token } = (await asOwner.documents({ documentId: root.id }).share.post()).data!;
      expect((await subpage(token, child.id)).status).toBe(404);

      const same = await asOwner
        .documents({ documentId: root.id })
        .share.post({ includeChildren: true });
      expect(same.data!.token).toBe(token);
      const shared = await api.share.document({ token }).get();
      expect(shared.data.pages.map((p: { id: number }) => p.id)).toEqual([
        root.id,
        child.id,
        grandchild.id,
      ]);
      const opened = await subpage(token, grandchild.id);
      expect(opened.status).toBe(200);
      expect(opened.data.document).toMatchObject({ id: grandchild.id, title: 'Grandchild' });
      expect((await subpage(token, parent.id)).status).toBe(404);
      expect((await subpage(token, sibling.id)).status).toBe(404);

      await asOwner.documents({ documentId: root.id }).share.post({ includeChildren: false });
      expect((await subpage(token, child.id)).status).toBe(404);
    });

    it('leaves private and archived subpages and everything below them out', async () => {
      const { asOwner, root, child, grandchild } = await tree();
      const secret = (
        await documents(asOwner).post({ title: 'Secret', parentId: root.id, isPrivate: true })
      ).data!;
      const { token } = (
        await asOwner.documents({ documentId: root.id }).share.post({ includeChildren: true })
      ).data!;
      expect((await subpage(token, secret.id)).status).toBe(404);

      await documents(asOwner)({ documentId: child.id }).archive.post({ version: child.version });
      const shared = await api.share.document({ token }).get();
      expect(shared.data.pages.map((p: { id: number }) => p.id)).toEqual([root.id]);
      expect((await subpage(token, child.id)).status).toBe(404);
      expect((await subpage(token, grandchild.id)).status).toBe(404);
    });

    it('serves no archived page, and refuses to share one', async () => {
      const { asOwner, root, sibling } = await tree();
      const { token } = (await asOwner.documents({ documentId: root.id }).share.post()).data!;
      await documents(asOwner)({ documentId: root.id }).archive.post({ version: root.version });
      expect((await api.share.document({ token }).get()).status).toBe(404);

      await documents(asOwner)({ documentId: sibling.id }).archive.post({
        version: sibling.version,
      });
      const res = await asOwner.documents({ documentId: sibling.id }).share.post();
      expect(res.status).toBe(409);
    });

    it('has no link for a private page, and making a page private revokes it', async () => {
      const { asOwner, root } = await tree();
      const secret = (await documents(asOwner).post({ title: 'Secret', isPrivate: true })).data!;
      expect((await asOwner.documents({ documentId: secret.id }).share.post()).status).toBe(404);

      const { token } = (await asOwner.documents({ documentId: root.id }).share.post()).data!;
      const made = await documents(asOwner)({ documentId: root.id }).access.post({
        version: root.version,
        isPrivate: true,
      });
      expect(made.data).toMatchObject({ isPrivate: true, shareToken: null });
      await documents(asOwner)({ documentId: root.id }).access.post({
        version: made.data!.version,
        isPrivate: false,
      });
      expect((await api.share.document({ token }).get()).status).toBe(404);
    });

    it('expires like an issue link and starts a new one without the subpages', async () => {
      const { asOwner, root } = await tree();
      const first = (
        await asOwner.documents({ documentId: root.id }).share.post({
          includeChildren: true,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        })
      ).data!;
      await db
        .update(projectDocument)
        .set({ shareExpiresAt: new Date(Date.now() - 1000) })
        .where(eq(projectDocument.id, root.id));
      expect((await api.share.document({ token: first.token }).get()).status).toBe(404);
      const read = await documents(asOwner)({ documentId: root.id }).get();
      expect(read.data).toMatchObject({ shareToken: null, shareExpiresAt: null });

      expect(await sweepExpiredShares()).toBe(1);
      const again = (await asOwner.documents({ documentId: root.id }).share.post()).data!;
      expect(again.token).not.toBe(first.token);
      expect(again.expiresAt).toBeNull();
      const reread = await documents(asOwner)({ documentId: root.id }).get();
      expect(reread.data!.shareIncludeChildren).toBe(false);
      expect((await api.share.document({ token: first.token }).get()).status).toBe(404);
    });

    it('takes the permission to edit documents', async () => {
      const { asOwner, root } = await tree();
      const readerRole = await createRole(asOwner, 'MKT', {
        name: 'Reader',
        permissions: { documents: { read: true } },
      });
      const user = await signUpTestUser();
      const invite = await asOwner
        .projects({ projectKey: 'MKT' })
        .invites.post({ email: user.email, role: 'member' });
      const reader = authedApi(user.cookie);
      await reader.invites({ token: invite.data!.token }).accept.post();
      await asOwner
        .projects({ projectKey: 'MKT' })
        .members({ userId: user.userId })
        .patch({ role: 'member', roleId: readerRole.data!.id });
      expect((await reader.documents({ documentId: root.id }).share.post()).status).toBe(403);
      expect((await reader.documents({ documentId: root.id }).share.delete()).status).toBe(403);

      const outsider = authedApi((await signUpTestUser()).cookie);
      expect((await outsider.documents({ documentId: root.id }).share.post()).status).toBe(403);
      expect((await asOwner.documents({ documentId: 999999 }).share.post()).status).toBe(404);
    });

    it('serves the assets of the pages the link opens and no others', async () => {
      const { asOwner, root, sibling, child } = await tree();
      const upload = async (documentId: number) =>
        (
          await documents(asOwner)({ documentId }).assets.post({
            file: new File([`bytes of ${documentId}`], 'shot.png', { type: 'image/png' }),
          })
        ).data!;
      const own = await upload(root.id);
      const below = await upload(child.id);
      const beside = await upload(sibling.id);
      await documents(asOwner)({ documentId: root.id }).patch({
        version: root.version,
        content: `![own](/protected-media${own.url})\n\n![beside](/protected-media${beside.url})`,
      });

      const { token } = (await asOwner.documents({ documentId: root.id }).share.post()).data!;
      const shared = await api.share.document({ token }).get();
      expect(shared.data.document.content).toBe(
        `![own](/media/share/document/${token}/assets/${own.id}/raw)\n\n` +
          `![beside](/media/share/document/${token}/assets/${beside.id}/raw)`,
      );

      const asset = (publicId: string) =>
        api.share.document({ token }).assets({ publicId }).raw.get();
      const served = await asset(own.id);
      expect(served.status).toBe(200);
      expect(String(served.data)).toBe(`bytes of ${root.id}`);
      expect(served.response.headers.get('x-content-type-options')).toBe('nosniff');
      expect((await asset(beside.id)).status).toBe(404);
      expect((await asset(below.id)).status).toBe(404);

      await asOwner.documents({ documentId: root.id }).share.post({ includeChildren: true });
      expect((await asset(below.id)).status).toBe(200);
      expect((await asset(beside.id)).status).toBe(404);

      await asOwner.documents({ documentId: root.id }).share.delete();
      expect((await asset(own.id)).status).toBe(404);
    });
  });
});
