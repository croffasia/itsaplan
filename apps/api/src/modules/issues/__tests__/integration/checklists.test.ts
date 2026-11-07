import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { untaggedRoutes } from '#tests/helpers/mcp';

// Checklists: an issue holds several checklists, each holding checkbox items. Both
// are ordered by position within their parent and come back with the issue read
// (GET /issues/:issueId → `checklists`). A checklist and its items are part of the
// issue, so they take the same work_items permission. The structural changes are
// written to the activity feed; checking a box is not.

interface Setup {
  asOwner: Api;
  columnId: number;
}

async function setupProject(): Promise<Setup> {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  return { asOwner, columnId: view.data!.columns[0].id };
}

function createIssue(client: Api, columnId: number, title = 'Task') {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
}

// An issue with one checklist on it, the shape most of the tests start from.
async function issueWithChecklist(client: Api, columnId: number, title = 'Release steps') {
  const issue = (await createIssue(client, columnId)).data!;
  const checklist = (await client.issues({ issueId: issue.id }).checklists.post({ title })).data!;
  return { issue, checklist };
}

function addItem(client: Api, checklistId: number, content: string) {
  return client.checklists({ checklistId }).items.post({ content });
}

function addItems(client: Api, checklistId: number, contents: string[]) {
  return client.checklists({ checklistId }).items.batch.post({
    items: contents.map((content) => ({ content })),
  });
}

async function read(client: Api, issueId: number) {
  const res = await client.issues({ issueId }).get();
  return res.data!;
}

async function feedActions(client: Api, issueId: number) {
  const res = await client.issues({ issueId }).feed.get({ query: {} });
  return res.data!.items.map((item) => item.action);
}

describe('checklists', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create', () => {
    it('adds a checklist and carries it on the issue read', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);

      expect(checklist).toMatchObject({ title: 'Release steps', items: [] });
      expect(await read(asOwner, issue.id)).toMatchObject({
        checklists: [{ id: checklist.id, title: 'Release steps', items: [] }],
      });
    });

    it('rejects an empty title with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner.issues({ issueId: issue.id }).checklists.post({ title: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a title over 200 characters with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner
        .issues({ issueId: issue.id })
        .checklists.post({ title: 'x'.repeat(201) });
      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown issue', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner
        .issues({ issueId: issue.id + 999 })
        .checklists.post({ title: 'Nowhere' });
      expect(res.status).toBe(404);
    });

    it('denies a non-member with 403', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await outsider.issues({ issueId: issue.id }).checklists.post({ title: 'Mine' });
      expect(res.status).toBe(403);
    });
  });

  describe('items', () => {
    it('appends items in the order they were added', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);

      await addItem(asOwner, checklist.id, 'Tag the release');
      await addItem(asOwner, checklist.id, 'Publish the notes');

      expect(await read(asOwner, issue.id)).toMatchObject({
        checklists: [
          {
            id: checklist.id,
            items: [
              { content: 'Tag the release', done: false },
              { content: 'Publish the notes', done: false },
            ],
          },
        ],
      });
    });

    it('checks an item off', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const item = (await addItem(asOwner, checklist.id, 'Tag the release')).data!;

      const res = await asOwner.checklists.items({ itemId: item.id }).patch({ done: true });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: item.id, done: true });
      expect((await read(asOwner, issue.id)).checklists[0].items).toMatchObject([
        { id: item.id, done: true },
      ]);
    });

    it('edits an item and leaves its checked state alone', async () => {
      const { asOwner, columnId } = await setupProject();
      const { checklist } = await issueWithChecklist(asOwner, columnId);
      const item = (await addItem(asOwner, checklist.id, 'Tag the relase')).data!;
      await asOwner.checklists.items({ itemId: item.id }).patch({ done: true });

      const res = await asOwner.checklists
        .items({ itemId: item.id })
        .patch({ content: 'Tag the release' });
      expect(res.data).toMatchObject({ content: 'Tag the release', done: true });
    });

    it('returns the item unchanged when the patch carries no fields', async () => {
      const { asOwner, columnId } = await setupProject();
      const { checklist } = await issueWithChecklist(asOwner, columnId);
      const item = (await addItem(asOwner, checklist.id, 'Tag the release')).data!;
      await asOwner.checklists.items({ itemId: item.id }).patch({ done: true });

      const res = await asOwner.checklists.items({ itemId: item.id }).patch({});
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: item.id, content: 'Tag the release', done: true });
    });

    it('rejects empty content with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const { checklist } = await issueWithChecklist(asOwner, columnId);

      const res = await addItem(asOwner, checklist.id, '');
      expect(res.status).toBe(400);
    });

    it('deletes an item', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const item = (await addItem(asOwner, checklist.id, 'Tag the release')).data!;

      const res = await asOwner.checklists.items({ itemId: item.id }).delete();
      expect(res.status).toBe(204);
      expect((await read(asOwner, issue.id)).checklists[0].items).toEqual([]);
    });

    it('returns 404 for an unknown item', async () => {
      const { asOwner, columnId } = await setupProject();
      const { checklist } = await issueWithChecklist(asOwner, columnId);
      const item = (await addItem(asOwner, checklist.id, 'Tag the release')).data!;

      const res = await asOwner.checklists.items({ itemId: item.id + 999 }).delete();
      expect(res.status).toBe(404);
    });

    it('denies a non-member with 403', async () => {
      const { asOwner, columnId } = await setupProject();
      const { checklist } = await issueWithChecklist(asOwner, columnId);
      const outsider = authedApi((await signUpTestUser()).cookie);

      const res = await addItem(outsider, checklist.id, 'Mine');
      expect(res.status).toBe(403);
    });
  });

  describe('rename and delete', () => {
    it('renames a checklist', async () => {
      const { asOwner, columnId } = await setupProject();
      const { checklist } = await issueWithChecklist(asOwner, columnId);

      const res = await asOwner
        .checklists({ checklistId: checklist.id })
        .patch({ title: 'Launch steps' });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: checklist.id, title: 'Launch steps' });
    });

    it('deletes a checklist and its items with it', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const item = (await addItem(asOwner, checklist.id, 'Tag the release')).data!;

      const res = await asOwner.checklists({ checklistId: checklist.id }).delete();
      expect(res.status).toBe(204);
      expect((await read(asOwner, issue.id)).checklists).toEqual([]);
      // The item went with the checklist, so nothing addresses it any more.
      expect((await asOwner.checklists.items({ itemId: item.id }).delete()).status).toBe(404);
    });

    it('returns 404 for an unknown checklist', async () => {
      const { asOwner, columnId } = await setupProject();
      const { checklist } = await issueWithChecklist(asOwner, columnId);

      const res = await asOwner.checklists({ checklistId: checklist.id + 999 }).delete();
      expect(res.status).toBe(404);
    });
  });

  describe('reorder', () => {
    it("sets the order of an issue's checklists", async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist: first } = await issueWithChecklist(asOwner, columnId, 'First');
      const second = (
        await asOwner.issues({ issueId: issue.id }).checklists.post({ title: 'Second' })
      ).data!;

      const res = await asOwner
        .issues({ issueId: issue.id })
        .checklists.reorder.put({ orderedIds: [second.id, first.id] });
      expect(res.status).toBe(200);
      expect(res.data!.map((list) => list.id)).toEqual([second.id, first.id]);
      expect((await read(asOwner, issue.id)).checklists.map((list) => list.id)).toEqual([
        second.id,
        first.id,
      ]);
    });

    it('sets the order of the items within a checklist', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const first = (await addItem(asOwner, checklist.id, 'First')).data!;
      const second = (await addItem(asOwner, checklist.id, 'Second')).data!;

      const res = await asOwner
        .checklists({ checklistId: checklist.id })
        .items.reorder.put({ orderedIds: [second.id, first.id] });
      expect(res.status).toBe(200);
      expect(res.data!.map((item) => item.id)).toEqual([second.id, first.id]);
      expect((await read(asOwner, issue.id)).checklists[0].items.map((item) => item.id)).toEqual([
        second.id,
        first.id,
      ]);
    });

    it('ignores an id belonging to another checklist', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const mine = (await addItem(asOwner, checklist.id, 'Mine')).data!;
      const other = (
        await asOwner.issues({ issueId: issue.id }).checklists.post({ title: 'Other' })
      ).data!;
      const first = (await addItem(asOwner, other.id, 'Foreign first')).data!;
      const second = (await addItem(asOwner, other.id, 'Foreign second')).data!;

      const res = await asOwner
        .checklists({ checklistId: checklist.id })
        .items.reorder.put({ orderedIds: [second.id, mine.id] });
      expect(res.status).toBe(200);
      expect(res.data!.map((item) => item.id)).toEqual([mine.id]);
      // The foreign item kept both its checklist and its position on it — a
      // reorder scoped only by item id would have moved it to the front.
      expect((await read(asOwner, issue.id)).checklists[1].items.map((item) => item.id)).toEqual([
        first.id,
        second.id,
      ]);
    });

    it('rejects an empty id list with 400', async () => {
      const { asOwner, columnId } = await setupProject();
      const { checklist } = await issueWithChecklist(asOwner, columnId);

      const res = await asOwner
        .checklists({ checklistId: checklist.id })
        .items.reorder.put({ orderedIds: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('batch items', () => {
    it('appends in input order and records each item without changing existing items', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const previous = (await addItem(asOwner, checklist.id, 'Already done')).data!;
      await asOwner.checklists.items({ itemId: previous.id }).patch({ done: true });

      const result = await addItems(asOwner, checklist.id, ['Tag release', 'Publish notes']);
      expect(result.status).toBe(201);
      expect(result.data).toMatchObject([
        { content: 'Tag release', done: false, position: previous.position + 1000 },
        { content: 'Publish notes', done: false, position: previous.position + 2000 },
      ]);
      expect((await read(asOwner, issue.id)).checklists[0].items).toEqual([
        { ...previous, done: true },
        ...result.data!,
      ]);
      const feed = await asOwner.issues({ issueId: issue.id }).feed.get({ query: {} });
      for (const item of result.data!) {
        expect(feed.data!.items).toContainEqual(
          expect.objectContaining({
            action: 'checklist_item_add',
            payload: {
              subject: { value: checklist.title, id: checklist.id },
              to: { value: item.content, id: item.id },
            },
          }),
        );
      }
    });

    it('accepts 100 items and 500-character content, and still supports single-item appends', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const contents = Array.from({ length: 100 }, (_, i) =>
        i === 0 ? 'x'.repeat(500) : `Item ${i}`,
      );
      const result = await addItems(asOwner, checklist.id, contents);
      expect(result.status).toBe(201);
      expect(result.data!.map((item) => item.content)).toEqual(contents);
      const last = await addItem(asOwner, checklist.id, 'Last');
      expect(last.status).toBe(201);
      expect(last.data!.position).toBe(result.data![99].position + 1000);
      expect((await read(asOwner, issue.id)).checklists[0].items).toHaveLength(101);
    });

    it.each([0, 101])('rejects a batch of %i items without writing any', async (size) => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const before = await feedActions(asOwner, issue.id);
      const result = await addItems(asOwner, checklist.id, Array(size).fill('Step'));
      expect(result.status).toBe(400);
      expect((await read(asOwner, issue.id)).checklists[0].items).toEqual([]);
      expect(await feedActions(asOwner, issue.id)).toEqual(before);
    });

    it.each(['', 'x'.repeat(501)])(
      'rejects invalid content without a partial batch',
      async (invalid) => {
        const { asOwner, columnId } = await setupProject();
        const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
        const before = await feedActions(asOwner, issue.id);
        expect((await addItems(asOwner, checklist.id, ['Valid', invalid])).status).toBe(400);
        expect((await read(asOwner, issue.id)).checklists[0].items).toEqual([]);
        expect(await feedActions(asOwner, issue.id)).toEqual(before);
      },
    );

    it('returns 404 for an unknown checklist', async () => {
      const { asOwner, columnId } = await setupProject();
      const { checklist } = await issueWithChecklist(asOwner, columnId);
      expect((await addItems(asOwner, checklist.id + 999, ['Step'])).status).toBe(404);
    });

    it('denies a non-member without changing the checklist', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const outsider = await signUpTestUser();
      const result = await addItems(authedApi(outsider.cookie), checklist.id, ['Forbidden']);
      expect(result.status).toBe(403);
      expect((await read(asOwner, issue.id)).checklists[0].items).toEqual([]);
    });

    it('respects the project checklist switch', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const settings = await asOwner.projects({ projectKey: 'MKT' }).settings.patch({
        features: { checklists: false },
      });
      expect(settings.status).toBe(200);
      expect((await addItems(asOwner, checklist.id, ['Forbidden'])).status).toBe(403);
      expect((await read(asOwner, issue.id)).checklists[0].items).toEqual([]);
    });

    it('keeps concurrent batches and a single append in separate ordered ranges', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const [first, second, single] = await Promise.all([
        addItems(asOwner, checklist.id, ['A1', 'A2']),
        addItems(asOwner, checklist.id, ['B1', 'B2']),
        addItem(asOwner, checklist.id, 'Single'),
      ]);
      expect([first.status, second.status, single.status]).toEqual([201, 201, 201]);
      const groups = [first.data!, second.data!, [single.data!]].sort(
        (a, b) => a[0].position - b[0].position,
      );
      const items = (await read(asOwner, issue.id)).checklists[0].items;
      expect(items.map((item) => item.id)).toEqual(groups.flat().map((item) => item.id));
      expect(new Set(items.map((item) => item.position)).size).toBe(5);
    });
  });

  // Structural changes belong in the feed; a checkbox toggle is the most frequent
  // write here and would bury the rest of it.
  describe('activity', () => {
    it('logs the checklist and item changes', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const item = (await addItem(asOwner, checklist.id, 'Tag the release')).data!;
      await asOwner.checklists({ checklistId: checklist.id }).patch({ title: 'Launch steps' });
      await asOwner.checklists.items({ itemId: item.id }).delete();

      const feed = await asOwner.issues({ issueId: issue.id }).feed.get({ query: {} });
      const entries = feed.data!.items;
      expect(entries).toContainEqual(
        expect.objectContaining({
          action: 'checklist_add',
          payload: { to: { value: 'Release steps', id: checklist.id } },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          action: 'checklist_item_add',
          payload: {
            subject: { value: 'Release steps', id: checklist.id },
            to: { value: 'Tag the release', id: item.id },
          },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          action: 'checklist_rename',
          payload: {
            from: { value: 'Release steps', id: checklist.id },
            to: { value: 'Launch steps', id: checklist.id },
          },
        }),
      );
      expect(entries).toContainEqual(
        expect.objectContaining({
          action: 'checklist_item_remove',
          payload: {
            subject: { value: 'Launch steps', id: checklist.id },
            from: { value: 'Tag the release', id: item.id },
          },
        }),
      );
    });

    it('logs the checklist removal', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      await asOwner.checklists({ checklistId: checklist.id }).delete();

      const feed = await asOwner.issues({ issueId: issue.id }).feed.get({ query: {} });
      expect(feed.data!.items).toContainEqual(
        expect.objectContaining({
          action: 'checklist_remove',
          payload: { from: { value: 'Release steps', id: checklist.id } },
        }),
      );
    });

    it('writes nothing when an item is only checked off', async () => {
      const { asOwner, columnId } = await setupProject();
      const { issue, checklist } = await issueWithChecklist(asOwner, columnId);
      const item = (await addItem(asOwner, checklist.id, 'Tag the release')).data!;
      const before = await feedActions(asOwner, issue.id);

      await asOwner.checklists.items({ itemId: item.id }).patch({ done: true });
      await asOwner.checklists.items({ itemId: item.id }).patch({ done: false });

      expect(await feedActions(asOwner, issue.id)).toEqual(before);
    });
  });

  // The list comes with the issue read, so it stays session-only.
  it('exposes the checklist writes an agent needs to MCP', () => {
    expect(untaggedRoutes((route) => route.includes('checklist'))).toEqual([
      'GET /issues/:issueId/checklists',
    ]);
  });
});
