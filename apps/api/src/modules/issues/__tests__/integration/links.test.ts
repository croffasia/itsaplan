import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { type IssueLinkInputKind } from '../../links';

// Relations between issues. A relation is one row and shows on both issues, each
// reading it from its own side: the source of a 'blocks' row blocks, its target is
// blocked by. POST /issues/:issueId/links states the relation as read from the
// issue in the path, so 'blocked_by' and 'duplicated_by' create the same rows as
// 'blocks' and 'duplicates' from the other end. The relations come back with the
// issue (GET /issues/:issueId → `links`) and, with the other end as an id, on each
// issue of the board payload (GET /projects/:projectKey/issues/board).

interface Setup {
  asOwner: Api;
  columnId: number;
}

async function setupProject(): Promise<Setup> {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  return { asOwner, columnId: view.data!.columns[0].id };
}

function createIssue(client: Api, columnId: number, title = 'Task') {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
}

// Two issues of the same project, the pair every relation test links.
async function twoIssues(client: Api, columnId: number) {
  const first = (await createIssue(client, columnId, 'First')).data!;
  const second = (await createIssue(client, columnId, 'Second')).data!;
  return { first, second };
}

async function linksOf(client: Api, issueId: number) {
  const res = await client.issues({ issueId }).get();
  return res.data!.links;
}

// The relation is stated as read from issueId, the issue in the path.
function link(client: Api, issueId: number, targetIssueId: number, kind: IssueLinkInputKind) {
  return client.issues({ issueId }).links.post({ targetIssueId, kind });
}

function unlink(client: Api, issueId: number, linkId: number) {
  return client.issues({ issueId }).links({ linkId }).delete();
}

// An issue of a second project, which no issue of the first one may link to.
async function foreignIssue(client: Api) {
  await client.projects.post({ key: 'OPS', name: 'Operations' });
  const view = await client.projects({ projectKey: 'OPS' }).get();
  const res = await client
    .projects({ projectKey: 'OPS' })
    .issues.post({ columnId: view.data!.columns[0].id, title: 'Elsewhere' });
  return res.data!;
}

describe('issue links', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create', () => {
    it('links two issues and shows the relation from both sides', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);

      const created = await link(asOwner, first.id, second.id, 'blocks');
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        kind: 'blocks',
        direction: 'outward',
        issue: { id: second.id, identifier: second.identifier, title: 'Second' },
      });

      expect(await linksOf(asOwner, first.id)).toMatchObject([
        { kind: 'blocks', direction: 'outward', issue: { id: second.id } },
      ]);
      expect(await linksOf(asOwner, second.id)).toMatchObject([
        { kind: 'blocks', direction: 'inward', issue: { id: first.id } },
      ]);
    });

    it('stores blocked_by as the same row read from the other end', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);

      const created = await link(asOwner, first.id, second.id, 'blocked_by');
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ kind: 'blocks', direction: 'inward' });

      expect(await linksOf(asOwner, second.id)).toMatchObject([
        { kind: 'blocks', direction: 'outward', issue: { id: first.id } },
      ]);
    });

    it('stores duplicated_by as the same row read from the other end', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);

      const created = await link(asOwner, first.id, second.id, 'duplicated_by');
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ kind: 'duplicates', direction: 'inward' });

      expect(await linksOf(asOwner, second.id)).toMatchObject([
        { kind: 'duplicates', direction: 'outward', issue: { id: first.id } },
      ]);
    });

    it('rejects the mirrored relates as a duplicate', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);

      await link(asOwner, first.id, second.id, 'relates');
      const mirrored = await link(asOwner, second.id, first.id, 'relates');
      expect(mirrored.status).toBe(409);
      expect(await linksOf(asOwner, first.id)).toHaveLength(1);
    });

    it('rejects the same relation twice with 409', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);

      await link(asOwner, first.id, second.id, 'blocks');
      const again = await link(asOwner, first.id, second.id, 'blocks');
      expect(again.status).toBe(409);
    });

    it('rejects the contradicting inverse of a directional relation with 409', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);

      await link(asOwner, first.id, second.id, 'blocks');
      const inverse = await link(asOwner, second.id, first.id, 'blocks');
      expect(inverse.status).toBe(409);
    });

    it('keeps relations of different kinds on the same pair', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);

      await link(asOwner, first.id, second.id, 'blocks');
      const related = await link(asOwner, first.id, second.id, 'relates');
      expect(related.status).toBe(201);
      expect(await linksOf(asOwner, first.id)).toHaveLength(2);
    });

    it('rejects linking an issue to itself with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await link(asOwner, issue.id, issue.id, 'relates');
      expect(res.status).toBe(400);
    });

    it('rejects a target in another project with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const outside = await foreignIssue(asOwner);

      const res = await link(asOwner, issue.id, outside.id, 'relates');
      expect(res.status).toBe(400);
    });

    it('returns 404 for a missing target', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await link(asOwner, issue.id, 999999, 'relates');
      expect(res.status).toBe(404);
    });

    it('rejects an unknown kind', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);

      // Not one of the five accepted relations.
      const res = await link(asOwner, first.id, second.id, 'caused_by' as 'relates');
      expect(res.status).toBe(400);
    });

    it('records the relation in both issues activity, each from its own side', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);

      await link(asOwner, first.id, second.id, 'blocks');

      const sourceFeed = await asOwner.issues({ issueId: first.id }).feed.get({ query: {} });
      expect(sourceFeed.data!.items).toContainEqual(
        expect.objectContaining({
          action: 'link_add',
          payload: {
            subject: { value: 'blocks' },
            to: { value: second.identifier, id: second.id },
          },
        }),
      );
      const targetFeed = await asOwner.issues({ issueId: second.id }).feed.get({ query: {} });
      expect(targetFeed.data!.items).toContainEqual(
        expect.objectContaining({
          action: 'link_add',
          payload: {
            subject: { value: 'blocked_by' },
            to: { value: first.identifier, id: first.id },
          },
        }),
      );
    });

    it('denies a non-member with 403', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await link(outsider, first.id, second.id, 'relates');
      expect(res.status).toBe(403);
    });
  });

  // The work-items views read each issue's relations off the board payload, and
  // refetch it when its change marker moves — which no relation changes an issue's
  // updated_at for, so the marker has to count them itself.
  describe('board payload', () => {
    // The board's issue by its id, with the relations it carries.
    async function boardIssue(client: Api, issueId: number) {
      const res = await client.projects({ projectKey: 'MKT' }).issues.board.get();
      expect(res.status).toBe(200);
      return res.data!.issues.find((row) => row.id === issueId)!;
    }

    it('carries the relation on both of its issues, each from its own side', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);
      const created = (await link(asOwner, first.id, second.id, 'blocked_by')).data!;

      expect((await boardIssue(asOwner, first.id)).links).toMatchObject([
        { id: created.id, relation: 'blocked_by', issueId: second.id },
      ]);
      expect((await boardIssue(asOwner, second.id)).links).toMatchObject([
        { id: created.id, relation: 'blocks', issueId: first.id },
      ]);
    });

    it('leaves out a relation to an archived issue', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);
      await link(asOwner, first.id, second.id, 'blocks');

      await asOwner.issues({ issueId: second.id }).archive.post();

      expect((await boardIssue(asOwner, first.id)).links).toEqual([]);
    });

    it('leaves out another project’s relations', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);
      await link(asOwner, first.id, second.id, 'relates');
      const foreign = await foreignIssue(asOwner);

      const res = await asOwner.projects({ projectKey: 'OPS' }).issues.board.get();
      expect(res.data!.issues.find((row) => row.id === foreign.id)!.links).toEqual([]);
    });
  });

  describe('remove', () => {
    it('removes the relation from both issues', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);
      const created = (await link(asOwner, first.id, second.id, 'blocks')).data!;

      const res = await unlink(asOwner, first.id, created.id);
      expect(res.status).toBe(204);
      expect(await linksOf(asOwner, first.id)).toHaveLength(0);
      expect(await linksOf(asOwner, second.id)).toHaveLength(0);
    });

    it('removes it from the target side too', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);
      await link(asOwner, first.id, second.id, 'blocks');
      const [onTarget] = await linksOf(asOwner, second.id);

      const res = await unlink(asOwner, second.id, onTarget.id);
      expect(res.status).toBe(204);
      expect(await linksOf(asOwner, first.id)).toHaveLength(0);
    });

    it('returns 404 for a link of two other issues', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);
      const other = (await createIssue(asOwner, columnId, 'Third')).data!;
      const created = (await link(asOwner, first.id, second.id, 'blocks')).data!;

      const res = await unlink(asOwner, other.id, created.id);
      expect(res.status).toBe(404);
      expect(await linksOf(asOwner, first.id)).toHaveLength(1);
    });

    it('returns 404 for a missing link', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await unlink(asOwner, issue.id, 999999);
      expect(res.status).toBe(404);
    });

    it('records the removal in both issues activity', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);
      const created = (await link(asOwner, first.id, second.id, 'duplicates')).data!;

      await unlink(asOwner, first.id, created.id);

      const sourceFeed = await asOwner.issues({ issueId: first.id }).feed.get({ query: {} });
      expect(sourceFeed.data!.items).toContainEqual(
        expect.objectContaining({
          action: 'link_remove',
          payload: {
            subject: { value: 'duplicates' },
            to: { value: second.identifier, id: second.id },
          },
        }),
      );
      const targetFeed = await asOwner.issues({ issueId: second.id }).feed.get({ query: {} });
      expect(targetFeed.data!.items).toContainEqual(
        expect.objectContaining({
          action: 'link_remove',
          payload: {
            subject: { value: 'duplicated_by' },
            to: { value: first.identifier, id: first.id },
          },
        }),
      );
    });

    it('drops the relations of a deleted issue', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);
      await link(asOwner, first.id, second.id, 'blocks');

      await asOwner.issues({ issueId: first.id }).delete();
      expect(await linksOf(asOwner, second.id)).toHaveLength(0);
    });

    it('denies a non-member with 403', async () => {
      const { asOwner, columnId } = await setupProject();
      const { first, second } = await twoIssues(asOwner, columnId);
      const created = (await link(asOwner, first.id, second.id, 'relates')).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await unlink(outsider, first.id, created.id);
      expect(res.status).toBe(403);
    });
  });
});
