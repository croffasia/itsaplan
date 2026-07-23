import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// Initiatives are a project-scoped grouping of issues. Issues link to one through
// issue.initiativeId. status is a fixed lifecycle enum; progress and health are
// derived from the linked issues' states and are not stored. The activity feed
// merges the initiative's own events with the activity of its linked issues.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columns = view.data!.columns;
  const columnId = columns[0].id;
  const doneColumnId = columns.find((c) => c.stateType === 'completed')!.id;
  return { owner, asOwner, columnId, doneColumnId };
}

const initiatives = (api: Api) => api.projects({ projectKey: 'MKT' }).initiatives;

function createInitiative(api: Api, body: { title: string } & Record<string, unknown>) {
  return initiatives(api).post(body);
}

describe('initiatives', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create', () => {
    it('creates an initiative with defaults and lists it', async () => {
      const { asOwner } = await setup();
      const created = await createInitiative(asOwner, { title: 'Q3 Launch' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        title: 'Q3 Launch',
        status: 'planned',
        ownerUserId: null,
        priority: null,
        progress: { completed: 0, total: 0, canceled: 0 },
        health: null,
      });
      expect(typeof created.data?.id).toBe('number');

      const list = await initiatives(asOwner).get();
      expect(list.data!.items.map((i) => i.title)).toEqual(['Q3 Launch']);
      expect(list.data!.total).toBe(1);
    });

    it('stores the provided fields and labels', async () => {
      const { asOwner } = await setup();
      const label = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'growth' }))
        .data!;
      const created = await createInitiative(asOwner, {
        title: 'Growth',
        status: 'active',
        priority: 'high',
        targetDate: '2026-09-01',
        labelIds: [label.id],
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        status: 'active',
        priority: 'high',
        labelIds: [label.id],
      });
      // Eden Treaty revives the ISO date string into a Date; assert the value.
      expect(new Date(created.data!.targetDate as unknown as string).toISOString()).toStartWith(
        '2026-09-01',
      );
    });

    it('rejects an empty title', async () => {
      const { asOwner } = await setup();
      const res = await createInitiative(asOwner, { title: '' });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid status', async () => {
      const { asOwner } = await setup();
      const res = await createInitiative(asOwner, { title: 'X', status: 'shipping' });
      expect(res.status).toBe(400);
    });

    it('rejects an owner and labels from another project before creating', async () => {
      const { asOwner } = await setup();
      const outsider = await signUpTestUser({ name: 'Outsider' });
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const foreignLabel = (
        await asOwner.projects({ projectKey: 'OPS' }).labels.post({ name: 'ops' })
      ).data!;

      const badOwner = await createInitiative(asOwner, {
        title: 'Bad owner',
        ownerUserId: outsider.userId,
      });
      const badLabel = await createInitiative(asOwner, {
        title: 'Bad label',
        labelIds: [foreignLabel.id],
      });

      expect(badOwner.status).toBe(400);
      expect(badLabel.status).toBe(400);
      expect((await initiatives(asOwner).get()).data!.items).toHaveLength(0);
    });
  });

  describe('list filter', () => {
    it('filters by a comma-separated status set', async () => {
      const { asOwner } = await setup();
      await createInitiative(asOwner, { title: 'A', status: 'active' });
      await createInitiative(asOwner, { title: 'P', status: 'planned' });
      await createInitiative(asOwner, { title: 'Pr', status: 'proposed' });

      const active = await initiatives(asOwner).get({ query: { status: 'active' } });
      expect(active.data!.items.map((i) => i.title)).toEqual(['A']);

      const planned = await initiatives(asOwner).get({ query: { status: 'proposed,planned' } });
      expect(planned.data!.items.map((i) => i.title).sort()).toEqual(['P', 'Pr']);
    });

    it('matches the title case-insensitively with search', async () => {
      const { asOwner } = await setup();
      await createInitiative(asOwner, { title: 'Growth loops' });
      await createInitiative(asOwner, { title: 'Retention' });

      const res = await initiatives(asOwner).get({ query: { search: 'GROWTH' } });
      expect(res.data!.items.map((i) => i.title)).toEqual(['Growth loops']);
      expect(res.data!.total).toBe(1);
    });
  });

  describe('list sort and paging', () => {
    it('sorts by title and reverses with dir', async () => {
      const { asOwner } = await setup();
      await createInitiative(asOwner, { title: 'B' });
      await createInitiative(asOwner, { title: 'A' });
      await createInitiative(asOwner, { title: 'C' });

      const asc = await initiatives(asOwner).get({ query: { sort: 'title' } });
      expect(asc.data!.items.map((i) => i.title)).toEqual(['A', 'B', 'C']);

      const desc = await initiatives(asOwner).get({ query: { sort: 'title', dir: 'desc' } });
      expect(desc.data!.items.map((i) => i.title)).toEqual(['C', 'B', 'A']);
    });

    it('sorts by priority severity, unset last', async () => {
      const { asOwner } = await setup();
      await createInitiative(asOwner, { title: 'none' });
      await createInitiative(asOwner, { title: 'low', priority: 'low' });
      await createInitiative(asOwner, { title: 'urgent', priority: 'urgent' });

      const res = await initiatives(asOwner).get({ query: { sort: 'priority' } });
      expect(res.data!.items.map((i) => i.title)).toEqual(['urgent', 'low', 'none']);
    });

    it('pages with page and pageSize and reports the full total', async () => {
      const { asOwner } = await setup();
      for (const title of ['A', 'B', 'C']) await createInitiative(asOwner, { title });

      const first = await initiatives(asOwner).get({
        query: { sort: 'title', page: 1, pageSize: 2 },
      });
      expect(first.data!.items.map((i) => i.title)).toEqual(['A', 'B']);
      expect(first.data!.total).toBe(3);

      const second = await initiatives(asOwner).get({
        query: { sort: 'title', page: 2, pageSize: 2 },
      });
      expect(second.data!.items.map((i) => i.title)).toEqual(['C']);
      expect(second.data!.total).toBe(3);
    });
  });

  describe('counts', () => {
    it('returns per-status counts for the tabs', async () => {
      const { asOwner } = await setup();
      await createInitiative(asOwner, { title: 'a1', status: 'active' });
      await createInitiative(asOwner, { title: 'a2', status: 'active' });
      await createInitiative(asOwner, { title: 'p', status: 'planned' });
      await createInitiative(asOwner, { title: 'c', status: 'completed' });

      const res = await initiatives(asOwner).counts.get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        total: 4,
        proposed: 0,
        planned: 1,
        active: 2,
        completed: 1,
        canceled: 0,
      });
    });
  });

  describe('get', () => {
    it('returns an initiative by id', async () => {
      const { asOwner } = await setup();
      const created = (await createInitiative(asOwner, { title: 'Q3' })).data!;
      const got = await asOwner.initiatives({ initiativeId: created.id }).get();
      expect(got.status).toBe(200);
      expect(got.data).toMatchObject({ id: created.id, title: 'Q3' });
    });

    it('returns 404 for a missing initiative', async () => {
      const { asOwner } = await setup();
      const res = await asOwner.initiatives({ initiativeId: 999999 }).get();
      expect(res.status).toBe(404);
    });
  });

  describe('update', () => {
    it('updates fields and labels', async () => {
      const { asOwner } = await setup();
      const created = (await createInitiative(asOwner, { title: 'Q3' })).data!;
      const label = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'growth' }))
        .data!;

      const patched = await asOwner.initiatives({ initiativeId: created.id }).patch({
        title: 'Q3 Launch',
        status: 'active',
        labelIds: [label.id],
      });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({
        title: 'Q3 Launch',
        status: 'active',
        labelIds: [label.id],
      });
    });

    it('returns 404 for a missing initiative', async () => {
      const { asOwner } = await setup();
      const res = await asOwner.initiatives({ initiativeId: 999999 }).patch({ title: 'x' });
      expect(res.status).toBe(404);
    });
  });

  describe('delete', () => {
    it('deletes the initiative but keeps its linked issues (unlinked)', async () => {
      const { asOwner, columnId } = await setup();
      const initiative = (await createInitiative(asOwner, { title: 'Q3' })).data!;
      const issue = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          .issues.post({ columnId, title: 'Task', initiativeId: initiative.id })
      ).data!;

      const del = await asOwner.initiatives({ initiativeId: initiative.id }).delete();
      expect(del.status).toBe(204);

      const gone = await asOwner.initiatives({ initiativeId: initiative.id }).get();
      expect(gone.status).toBe(404);

      // The issue survives, with its initiative link cleared.
      const survivor = await asOwner.issues({ issueId: issue.id }).get();
      expect(survivor.status).toBe(200);
      expect(survivor.data?.initiative).toBeNull();
    });
  });

  describe('linked issues, progress and health', () => {
    it('counts linked issues and reflects completion in progress', async () => {
      const { asOwner, columnId, doneColumnId } = await setup();
      const initiative = (
        await createInitiative(asOwner, { title: 'Q3', targetDate: '2026-09-01' })
      ).data!;
      const scope = asOwner.projects({ projectKey: 'MKT' }).issues;
      const a = (await scope.post({ columnId, title: 'A', initiativeId: initiative.id })).data!;
      await scope.post({ columnId, title: 'B', initiativeId: initiative.id });

      let got = await asOwner.initiatives({ initiativeId: initiative.id }).get();
      expect(got.data?.progress).toMatchObject({ completed: 0, total: 2 });

      // Move one issue to the completed column.
      await asOwner.issues({ issueId: a.id }).patch({ columnId: doneColumnId });
      got = await asOwner.initiatives({ initiativeId: initiative.id }).get();
      expect(got.data?.progress).toMatchObject({ completed: 1, total: 2 });
      expect(typeof got.data?.health).toBe('string');
    });

    it('links and unlinks an issue through update_issue', async () => {
      const { asOwner, columnId } = await setup();
      const initiative = (await createInitiative(asOwner, { title: 'Q3' })).data!;
      const issue = (
        await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' })
      ).data!;

      await asOwner.issues({ issueId: issue.id }).patch({ initiativeId: initiative.id });
      let got = await asOwner.initiatives({ initiativeId: initiative.id }).get();
      expect(got.data?.progress.total).toBe(1);

      await asOwner.issues({ issueId: issue.id }).patch({ initiativeId: null });
      got = await asOwner.initiatives({ initiativeId: initiative.id }).get();
      expect(got.data?.progress.total).toBe(0);
    });

    it('rejects linking an issue to an initiative from another project', async () => {
      const { asOwner, columnId } = await setup();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const otherInitiative = (
        await asOwner.projects({ projectKey: 'OPS' }).initiatives.post({ title: 'Other' })
      ).data!;
      const issue = (
        await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' })
      ).data!;

      const res = await asOwner
        .issues({ issueId: issue.id })
        .patch({ initiativeId: otherInitiative.id });
      expect(res.status).toBe(400);
    });
  });

  describe('feed', () => {
    it("records the initiative's own events and its linked issues' activity", async () => {
      const { asOwner, columnId } = await setup();
      const initiative = (await createInitiative(asOwner, { title: 'Q3' })).data!;
      await asOwner.initiatives({ initiativeId: initiative.id }).patch({ status: 'active' });

      const issue = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          .issues.post({ columnId, title: 'Task', initiativeId: initiative.id })
      ).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ title: 'Renamed' });

      const feed = await asOwner.initiatives({ initiativeId: initiative.id }).feed.get();
      expect(feed.status).toBe(200);
      const actions = feed.data!.items.map((i) => i.action);
      // Initiative-level events (created, status change) and issue activity are merged.
      expect(actions).toContain('created');
      expect(actions).toContain('status');
      expect(actions).toContain('title');
      // Issue rows carry the source 'issue' and an identifier; initiative rows do not.
      const issueRow = feed.data!.items.find((i) => i.action === 'title');
      expect(issueRow?.source).toBe('issue');
      expect(issueRow?.issueId).toBe(issue.id);
      expect(issueRow?.issueIdentifier).toMatch(/^MKT-\d+$/);
    });

    it('exposes a change marker that moves after an edit', async () => {
      const { asOwner } = await setup();
      const initiative = (await createInitiative(asOwner, { title: 'Q3' })).data!;
      const before = (await asOwner.initiatives({ initiativeId: initiative.id }).rev.get()).data!
        .rev;
      await asOwner.initiatives({ initiativeId: initiative.id }).patch({ status: 'active' });
      const after = (await asOwner.initiatives({ initiativeId: initiative.id }).rev.get()).data!
        .rev;
      expect(after).not.toBe(before);
    });
  });

  describe('access', () => {
    it('returns 404 for an unknown project', async () => {
      const { asOwner } = await setup();
      const res = await asOwner.projects({ projectKey: 'NOPE' }).initiatives.post({ title: 'x' });
      expect(res.status).toBe(404);
    });

    it('denies a non-member on the initiative routes', async () => {
      const { asOwner } = await setup();
      const initiative = (await createInitiative(asOwner, { title: 'Q3' })).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);

      expect(
        (await outsider.projects({ projectKey: 'MKT' }).initiatives.post({ title: 'x' })).status,
      ).toBe(403);
      expect((await outsider.projects({ projectKey: 'MKT' }).initiatives.get()).status).toBe(403);
      expect((await outsider.initiatives({ initiativeId: initiative.id }).get()).status).toBe(403);
      expect(
        (await outsider.initiatives({ initiativeId: initiative.id }).patch({ title: 'x' })).status,
      ).toBe(403);
      expect((await outsider.initiatives({ initiativeId: initiative.id }).delete()).status).toBe(
        403,
      );
    });
  });
});
