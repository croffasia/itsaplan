import { describe, it, expect, beforeEach } from 'bun:test';
import { api, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Public read-only sharing. Enabling sharing on an issue or a saved view sets an
// unguessable token; the /share/* GET routes then return a self-contained bundle
// (project scaffold + entity) with no session. Revoking clears the token, so the
// link stops working. The enable/revoke routes are gated by the same permission as
// editing the entity (work_items edit / views edit).

async function setup() {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
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
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
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
});
