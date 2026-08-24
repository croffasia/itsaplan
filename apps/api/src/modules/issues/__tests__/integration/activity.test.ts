import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser, type TestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// An issue's timeline (issue_activity): comments (POST /issues/:issueId/comments)
// and change-log entries recorded by the issue mutation routes, merged and paged
// newest first by GET /issues/:issueId/feed. Both routes resolve access through
// the workItem guard on the issue. Change-log entries are asserted through the
// feed — that is the observable output of an update.

interface Setup {
  asOwner: Api;
  owner: TestUser;
  columnId: number;
  columnIds: number[];
}

async function setupProject(): Promise<Setup> {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnIds = view.data!.columns.map((c) => c.id);
  return { asOwner, owner, columnId: columnIds[0], columnIds };
}

function createIssue(client: Api, columnId: number, patch: Record<string, unknown> = {}) {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task', ...patch });
}

// One page of the feed (newest first).
async function feed(client: Api, issueId: number, query: Record<string, string> = {}) {
  const res = await client.issues({ issueId }).feed.get({ query });
  return res;
}

describe('issue activity', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('comments', () => {
    it('adds a comment and returns it', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'looks good' });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ kind: 'comment', body: 'looks good', issueId: issue.id });
    });

    it('records the author from the session user', async () => {
      const { asOwner, owner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'mine' });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ actorUserId: owner.userId, actorName: 'Owner' });
    });

    it('shows the comment in the feed', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'first note' });

      const res = await feed(asOwner, issue.id);
      expect(res.status).toBe(200);
      const comment = res.data?.items.find((i) => i.kind === 'comment');
      expect(comment?.body).toBe('first note');
    });

    it('rejects an empty comment body', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const res = await asOwner.issues({ issueId: issue.id }).comments.post({ body: '' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when commenting on a missing issue', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.issues({ issueId: 999999 }).comments.post({ body: 'x' });
      expect(res.status).toBe(404);
    });
  });

  describe('feed', () => {
    it("records a 'created' entry when an issue is created", async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await feed(asOwner, issue.id);
      expect(res.status).toBe(200);
      expect(res.data?.items.some((i) => i.kind === 'activity' && i.action === 'created')).toBe(
        true,
      );
    });

    it('returns items newest first', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'one' });
      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'two' });

      const res = await feed(asOwner, issue.id);
      const comments = res.data!.items.filter((i) => i.kind === 'comment');
      expect(comments.map((c) => c.body)).toEqual(['two', 'one']);
    });

    it('pages through the feed with limit and cursor', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      for (const body of ['a', 'b', 'c']) {
        await asOwner.issues({ issueId: issue.id }).comments.post({ body });
      }

      const first = await feed(asOwner, issue.id, { limit: '2' });
      expect(first.data?.items.length).toBe(2);
      expect(first.data?.nextCursor).not.toBeNull();

      const second = await feed(asOwner, issue.id, {
        limit: '2',
        cursor: JSON.stringify(first.data!.nextCursor),
      });
      // No overlap between the two pages.
      const firstIds = first.data!.items.map((i) => i.id);
      const secondIds = second.data!.items.map((i) => i.id);
      expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    });

    it('serves the first page for a malformed cursor', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'note' });

      const res = await feed(asOwner, issue.id, { cursor: 'not-json' });
      expect(res.status).toBe(200);
      expect(res.data?.items.some((i) => i.kind === 'comment')).toBe(true);
    });

    it('returns 404 for a missing issue', async () => {
      const { asOwner } = await setupProject();
      const res = await feed(asOwner, 999999);
      expect(res.status).toBe(404);
    });
  });

  // A reply is a comment carrying replyToId. The feed pages over the top-level
  // entries and serves the replies of the ones on the page with them, so a thread is
  // never split across pages.
  describe('replies', () => {
    it('links a reply to the comment it answers', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const parent = (
        await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'question' })
      ).data!;

      const res = await asOwner
        .issues({ issueId: issue.id })
        .comments.post({ body: 'answer', replyToId: parent.id });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ kind: 'comment', replyToId: parent.id });
    });

    it('serves a reply with its parent, outside the page window', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const parent = (
        await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'question' })
      ).data!;
      await asOwner
        .issues({ issueId: issue.id })
        .comments.post({ body: 'answer', replyToId: parent.id });
      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'later' });

      // Two top-level entries fill the page; the reply rides along with its parent.
      const res = await feed(asOwner, issue.id, { limit: '2' });
      expect(res.data!.items.map((i) => i.body)).toEqual(['later', 'question', 'answer']);
    });

    it('keeps a reply out of the top-level page window', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const parent = (
        await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'question' })
      ).data!;
      await asOwner
        .issues({ issueId: issue.id })
        .comments.post({ body: 'answer', replyToId: parent.id });

      const first = await feed(asOwner, issue.id, { limit: '1' });
      expect(first.data!.items.map((i) => i.body)).toEqual(['question', 'answer']);
      const second = await feed(asOwner, issue.id, {
        limit: '1',
        cursor: JSON.stringify(first.data!.nextCursor),
      });
      expect(second.data!.items.some((i) => i.body === 'answer')).toBe(false);
    });

    it('groups a reply with its parent, whatever the status it was written in', async () => {
      const { asOwner, columnId, columnIds } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const parent = (
        await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'question' })
      ).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ columnId: columnIds[1] });
      await asOwner
        .issues({ issueId: issue.id })
        .comments.post({ body: 'answer', replyToId: parent.id });

      const res = await asOwner.issues({ issueId: issue.id }).feed.grouped.get({ query: {} });
      const bodies = res.data!.groups.map((g) =>
        g.items.filter((i) => i.kind === 'comment').map((i) => i.body),
      );
      expect(bodies).toEqual([[], ['question', 'answer']]);
    });

    it('rejects a reply to a comment on another issue', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const other = (await createIssue(asOwner, columnId, { title: 'Other' })).data!;
      const parent = (await asOwner.issues({ issueId: other.id }).comments.post({ body: 'there' }))
        .data!;

      const res = await asOwner
        .issues({ issueId: issue.id })
        .comments.post({ body: 'here', replyToId: parent.id });
      expect(res.status).toBe(400);
    });

    it('rejects a reply to a change-log entry', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const created = (await feed(asOwner, issue.id)).data!.items.find(
        (i) => i.kind === 'activity',
      )!;

      const res = await asOwner
        .issues({ issueId: issue.id })
        .comments.post({ body: 'reply', replyToId: created.id });
      expect(res.status).toBe(400);
    });
  });

  // Change-log entries are written by the issue mutation routes and read back
  // through the feed. Assert the action and its from/to text.
  describe('change log', () => {
    async function actions(client: Api, issueId: number) {
      const res = await feed(client, issueId, { limit: '100' });
      return res.data!.items.filter((i) => i.kind === 'activity');
    }

    it('logs a title change with its old and new value', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId, { title: 'Old' })).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ title: 'New' });

      const title = (await actions(asOwner, issue.id)).find((a) => a.action === 'title');
      expect(title?.payload).toMatchObject({ from: { value: 'Old' }, to: { value: 'New' } });
    });

    it('logs a column move as a status change with column names', async () => {
      const { asOwner, columnId, columnIds } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ columnId: columnIds[1] });

      const status = (await actions(asOwner, issue.id)).find((a) => a.action === 'status');
      expect(status).toBeDefined();
      expect(status?.payload.from?.value).toBeTruthy();
      expect(status?.payload.to?.value).toBeTruthy();
      expect(status?.payload.from?.value).not.toBe(status?.payload.to?.value);
      expect(status?.payload.to).toMatchObject({ id: columnIds[1], stateType: 'unstarted' });
    });

    it('logs an estimate change with the value it had before', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId, { estimatePoints: 3 })).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ estimatePoints: 5 });

      const entry = (await actions(asOwner, issue.id)).find((a) => a.action === 'estimate');
      expect(entry?.payload).toMatchObject({
        subject: { value: 'points' },
        from: { value: '3' },
        to: { value: '5' },
      });
    });

    it('logs the time estimate as hours and minutes', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ estimateMinutes: 90 });

      const entry = (await actions(asOwner, issue.id)).find((a) => a.action === 'estimate');
      expect(entry?.payload).toMatchObject({ subject: { value: 'time' }, to: { value: '1h 30m' } });
      expect(entry?.payload.from).toBeUndefined();
    });

    it('logs a cleared estimate with only the value it had', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId, { estimateMinutes: 120 })).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ estimateMinutes: null });

      const entry = (await actions(asOwner, issue.id)).find((a) => a.action === 'estimate');
      expect(entry?.payload).toMatchObject({ from: { value: '2h' } });
      expect(entry?.payload.to).toBeUndefined();
    });

    it('logs one entry per estimate kind changed in the same update', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ estimatePoints: 2, estimateMinutes: 30 });

      const entries = (await actions(asOwner, issue.id)).filter((a) => a.action === 'estimate');
      expect(entries.map((e) => e.payload.subject?.value).sort()).toEqual(['points', 'time']);
    });

    it('logs added and removed labels', async () => {
      const { asOwner, columnId } = await setupProject();
      const label = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'bug' }))
        .data!;
      const issue = (await createIssue(asOwner, columnId)).data!;

      await asOwner.issues({ issueId: issue.id }).patch({ labelIds: [label.id] });
      const added = (await actions(asOwner, issue.id)).find((a) => a.action === 'label_add');
      expect(added?.payload.to).toMatchObject({ value: 'bug', id: label.id });

      await asOwner.issues({ issueId: issue.id }).patch({ labelIds: [] });
      const removed = (await actions(asOwner, issue.id)).find((a) => a.action === 'label_remove');
      expect(removed?.payload.from).toMatchObject({ value: 'bug', id: label.id });
    });

    it("does not log the name of another project's label", async () => {
      const { asOwner, columnId } = await setupProject();
      await asOwner.projects.post({ key: 'OPS', name: 'Operations' });
      const foreign = (
        await asOwner.projects({ projectKey: 'OPS' }).labels.post({ name: 'ops-secret' })
      ).data!;
      const issue = (await createIssue(asOwner, columnId)).data!;

      const patched = await asOwner.issues({ issueId: issue.id }).patch({ labelIds: [foreign.id] });
      expect(patched.status).toBe(400);
      expect((await actions(asOwner, issue.id)).some((a) => a.action === 'label_add')).toBe(false);
    });

    it('logs a custom field value change', async () => {
      const { asOwner, columnId } = await setupProject();
      const field = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          ['custom-fields'].post({ name: 'Notes', fieldType: 'text' })
      ).data!;
      const issue = (await createIssue(asOwner, columnId)).data!;

      await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ value: 'written' });

      const entry = (await actions(asOwner, issue.id)).find((a) => a.action === 'field');
      expect(entry?.payload).toMatchObject({
        subject: { value: 'Notes', id: field.id },
        to: { value: 'written' },
      });
    });

    it('logs the chosen option of a select field with its id', async () => {
      const { asOwner, columnId } = await setupProject();
      const field = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          ['custom-fields'].post({ name: 'Size', fieldType: 'select', options: ['S', 'M'] })
      ).data!;
      const issue = (await createIssue(asOwner, columnId)).data!;
      const option = field.options[0];

      await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ optionIds: [option.id] });

      const entry = (await actions(asOwner, issue.id)).find((a) => a.action === 'field');
      expect(entry?.payload.to).toMatchObject({ value: option.value, id: option.id });
    });

    it('logs the chosen person of a member field with their id', async () => {
      const { asOwner, owner, columnId } = await setupProject();
      const field = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          ['custom-fields'].post({ name: 'Reviewer', fieldType: 'member' })
      ).data!;
      const issue = (await createIssue(asOwner, columnId)).data!;

      await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ value: owner.userId });

      const entry = (await actions(asOwner, issue.id)).find((a) => a.action === 'field');
      expect(entry?.payload.to).toMatchObject({ id: owner.userId });
    });

    it('does not log a position-only reorder', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const before = (await actions(asOwner, issue.id)).length;

      await asOwner.issues({ issueId: issue.id }).patch({ position: 42 });
      const after = await actions(asOwner, issue.id);
      expect(after.length).toBe(before);
    });
  });

  // The stretches the issue spent in one column, oldest first and without their
  // entries (GET /issues/:issueId/timeline).
  describe('timeline', () => {
    async function timeline(client: Api, issueId: number) {
      return client.issues({ issueId }).timeline.get();
    }

    it('returns one open segment for an issue that never moved', async () => {
      const { asOwner, columnId } = await setupProject();
      const view = await asOwner.projects({ projectKey: 'MKT' }).get();
      const columnName = view.data!.columns.find((c) => c.id === columnId)!.name;
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await timeline(asOwner, issue.id);
      expect(res.status).toBe(200);
      expect(res.data!.length).toBe(1);
      expect(res.data![0]).toMatchObject({ status: columnName, to: null });
    });

    it('splits at a status change and names both columns', async () => {
      const { asOwner, columnId, columnIds } = await setupProject();
      const view = await asOwner.projects({ projectKey: 'MKT' }).get();
      const names = new Map(view.data!.columns.map((c) => [c.id, c.name]));
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ columnId: columnIds[1] });

      const res = await timeline(asOwner, issue.id);
      expect(res.data!.map((s) => s.status)).toEqual([
        names.get(columnId)!,
        names.get(columnIds[1])!,
      ]);
      // The first stretch is closed at the move, the second is still open.
      expect(res.data![0]!.to).not.toBeNull();
      expect(res.data![1]!.to).toBeNull();
    });

    it('repeats a status as a separate segment when the issue returns to it', async () => {
      const { asOwner, columnId, columnIds } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ columnId: columnIds[1] });
      await asOwner.issues({ issueId: issue.id }).patch({ columnId: columnId });

      const res = await timeline(asOwner, issue.id);
      expect(res.data!.length).toBe(3);
      expect(res.data![0]!.status).toBe(res.data![2]!.status);
    });

    it('returns 404 for a missing issue', async () => {
      const { asOwner } = await setupProject();
      expect((await timeline(asOwner, 999999)).status).toBe(404);
    });
  });

  // The entries of one stretch, read when it is opened
  // (GET /issues/:issueId/timeline/items).
  describe('timeline items', () => {
    function itemsOf(client: Api, issueId: number, from: string, to?: string | null) {
      return client.issues({ issueId }).timeline.items.get({ query: to ? { from, to } : { from } });
    }

    it('serves each stretch the entries written while it was open', async () => {
      const { asOwner, columnId, columnIds } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'before the move' });
      await asOwner.issues({ issueId: issue.id }).patch({ columnId: columnIds[1] });
      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'after the move' });

      const segments = (await asOwner.issues({ issueId: issue.id }).timeline.get()).data!;
      const bodies = [];
      for (const segment of segments) {
        const res = await itemsOf(asOwner, issue.id, segment.from, segment.to);
        expect(res.status).toBe(200);
        bodies.push(res.data!.filter((i) => i.kind === 'comment').map((i) => i.body));
      }
      expect(bodies).toEqual([['before the move'], ['after the move']]);

      // The move itself opens the second stretch, so it reads as "entered from X".
      const opened = (await itemsOf(asOwner, issue.id, segments[1]!.from)).data!;
      expect(opened.some((i) => i.action === 'status')).toBe(true);
      const created = (await itemsOf(asOwner, issue.id, segments[0]!.from, segments[0]!.to)).data!;
      expect(created.some((i) => i.action === 'created')).toBe(true);
    });

    it('rejects a from that is not a datetime', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      expect((await itemsOf(asOwner, issue.id, 'yesterday')).status).toBe(400);
    });
  });

  // The same entries as the feed, split into the stretches the issue spent in one
  // status and paged the same way (GET /issues/:issueId/feed/grouped).
  describe('grouped feed', () => {
    function grouped(client: Api, issueId: number, query: Record<string, string> = {}) {
      return client.issues({ issueId }).feed.grouped.get({ query });
    }

    it('splits a page into the stretches its entries were written in', async () => {
      const { asOwner, columnId, columnIds } = await setupProject();
      const view = await asOwner.projects({ projectKey: 'MKT' }).get();
      const names = new Map(view.data!.columns.map((c) => [c.id, c.name]));
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'before the move' });
      await asOwner.issues({ issueId: issue.id }).patch({ columnId: columnIds[1] });
      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'after the move' });

      const res = await grouped(asOwner, issue.id);
      expect(res.status).toBe(200);
      // Newest first, so the stretch the issue is in now comes first and stays open.
      expect(res.data!.groups.map((g) => g.status)).toEqual([
        names.get(columnIds[1])!,
        names.get(columnId)!,
      ]);
      expect(res.data!.groups[0]!.to).toBeNull();
      const bodies = res.data!.groups.map((g) =>
        g.items.filter((i) => i.kind === 'comment').map((i) => i.body),
      );
      expect(bodies).toEqual([['after the move'], ['before the move']]);
    });

    it('marks a status the issue had already been in as a repeat', async () => {
      const { asOwner, columnId, columnIds } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).patch({ columnId: columnIds[1] });
      await asOwner.issues({ issueId: issue.id }).patch({ columnId });

      const res = await grouped(asOwner, issue.id);
      expect(res.data!.groups.map((g) => g.repeat)).toEqual([true, false, false]);
    });

    it('pages with limit and cursor, continuing a stretch across the boundary', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      for (const body of ['a', 'b', 'c']) {
        await asOwner.issues({ issueId: issue.id }).comments.post({ body });
      }

      const first = await grouped(asOwner, issue.id, { limit: '2' });
      expect(first.data!.groups.length).toBe(1);
      expect(first.data!.groups[0]!.items.map((i) => i.body)).toEqual(['c', 'b']);
      expect(first.data!.nextCursor).not.toBeNull();

      const second = await grouped(asOwner, issue.id, {
        limit: '2',
        cursor: JSON.stringify(first.data!.nextCursor),
      });
      // The one stretch spans both pages, under the same start, and no entry repeats.
      expect(second.data!.groups[0]!.from).toEqual(first.data!.groups[0]!.from);
      expect(second.data!.groups[0]!.items.map((i) => i.body)).toContain('a');
      const firstIds = first.data!.groups.flatMap((g) => g.items.map((i) => i.id));
      const secondIds = second.data!.groups.flatMap((g) => g.items.map((i) => i.id));
      expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    });

    it('returns 404 for a missing issue', async () => {
      const { asOwner } = await setupProject();
      expect((await grouped(asOwner, 999999)).status).toBe(404);
    });
  });

  describe('access', () => {
    it('denies a non-member on the feed, timeline and comment routes', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);

      // Guard-thrown 403 is not in Treaty's inferred error-status union, so assert
      // the top-level HTTP status rather than error.status.
      expect((await outsider.issues({ issueId: issue.id }).feed.get({ query: {} })).status).toBe(
        403,
      );
      expect(
        (await outsider.issues({ issueId: issue.id }).feed.grouped.get({ query: {} })).status,
      ).toBe(403);
      expect((await outsider.issues({ issueId: issue.id }).timeline.get()).status).toBe(403);
      expect(
        (
          await outsider
            .issues({ issueId: issue.id })
            .timeline.items.get({ query: { from: new Date(0).toISOString() } })
        ).status,
      ).toBe(403);
      expect(
        (await outsider.issues({ issueId: issue.id }).comments.post({ body: 'x' })).status,
      ).toBe(403);
    });
  });
});
