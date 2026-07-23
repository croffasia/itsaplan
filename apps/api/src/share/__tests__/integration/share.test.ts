import { describe, it, expect, beforeEach } from 'bun:test';
import { api, authedApi } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

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
  return { asOwner, issueId: issue.data!.id, columnId };
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
      const token = (await asOwner.issues({ issueId }).share.post()).data!.token;
      const shared = await api.share.issue({ token }).get();
      for (const a of shared.data.project.assignees) {
        expect((a as Record<string, unknown>).email).toBeUndefined();
      }
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
