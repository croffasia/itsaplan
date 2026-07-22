import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// Issues live under a project. Create is /projects/:projectKey/issues (permission
// guard on :projectKey); the other routes address the issue by its own id
// (/issues/:issueId) and resolve access through the workItem guard. An issue is
// read back through GET /issues/:issueId (with its custom field values) or through
// the project view (GET /projects/:projectKey → `issues`, which carries labelIds
// and set field values). createProject seeds five default columns.

interface Setup {
  asOwner: Api;
  columnId: number;
  columnIds: number[];
}

// A fresh project plus the ids of its seeded columns. columnIds[0] is used as the
// default target column for created issues.
async function setupProject(): Promise<Setup> {
  const owner = await signUpTestUser();
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnIds = view.data!.columns.map((c) => c.id);
  return { asOwner, columnId: columnIds[0], columnIds };
}

function createIssue(client: Api, columnId: number, patch: Record<string, unknown> = {}) {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task', ...patch });
}

// The board's issue list (carries labelIds and set custom field values).
async function issuesOf(client: Api, projectKey = 'MKT') {
  const board = await client.projects({ projectKey }).issues.board.get();
  return board.data!.issues;
}

describe('issues', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('create', () => {
    it('creates an issue and returns it with an identifier and position', async () => {
      const { asOwner, columnId } = await setupProject();

      const created = await createIssue(asOwner, columnId, { title: 'Ship the docs' });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({
        title: 'Ship the docs',
        columnId,
        description: '',
        labelIds: [],
      });
      expect(created.data?.identifier).toMatch(/^MKT-\d+$/);
      expect(typeof created.data?.id).toBe('number');
      expect(typeof created.data?.position).toBe('number');

      const list = await issuesOf(asOwner);
      expect(list.map((i) => i.id)).toContain(created.data!.id);
    });

    it('returns the linked initiative expanded to id and title', async () => {
      const { asOwner, columnId } = await setupProject();
      const initiative = (
        await asOwner.projects({ projectKey: 'MKT' }).initiatives.post({ title: 'Q3 Launch' })
      ).data!;

      const created = await createIssue(asOwner, columnId, { initiativeId: initiative.id });
      expect(created.status).toBe(201);
      expect(created.data?.initiative).toEqual({ id: initiative.id, title: 'Q3 Launch' });

      // The board payload carries the same expanded shape.
      const onBoard = (await issuesOf(asOwner)).find((i) => i.id === created.data!.id);
      expect(onBoard?.initiative).toEqual({ id: initiative.id, title: 'Q3 Launch' });
    });

    it('stores the optional fields when provided', async () => {
      const { asOwner, columnId } = await setupProject();
      const created = await createIssue(asOwner, columnId, {
        title: 'With details',
        description: 'the body',
        priority: 'high',
        startDate: '2026-01-01',
        dueDate: '2026-02-01',
      });
      expect(created.status).toBe(201);
      expect(created.data).toMatchObject({ description: 'the body', priority: 'high' });
      // `date` columns come back as 'YYYY-MM-DD', which Eden Treaty revives into a Date.
      expect(new Date(created.data!.startDate!).getTime()).toBe(new Date('2026-01-01').getTime());
      expect(new Date(created.data!.dueDate!).getTime()).toBe(new Date('2026-02-01').getTime());
    });

    it('hands out an increasing per-project sequence number', async () => {
      const { asOwner, columnId } = await setupProject();
      const first = (await createIssue(asOwner, columnId)).data!;
      const second = (await createIssue(asOwner, columnId)).data!;

      const seq = (id: string) => Number(id.split('-')[1]);
      expect(seq(second.identifier)).toBe(seq(first.identifier) + 1);
    });

    it('gives a later issue in the same column a higher position', async () => {
      const { asOwner, columnId } = await setupProject();
      const first = (await createIssue(asOwner, columnId)).data!;
      const second = (await createIssue(asOwner, columnId)).data!;
      expect(second.position).toBeGreaterThan(first.position);
    });

    it('attaches labels passed as labelIds', async () => {
      const { asOwner, columnId } = await setupProject();
      const label = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'bug' }))
        .data!;

      const created = await createIssue(asOwner, columnId, { labelIds: [label.id] });
      expect(created.status).toBe(201);
      expect(created.data?.labelIds).toEqual([label.id]);

      // The project view also reports the label on the issue.
      const list = await issuesOf(asOwner);
      expect(list.find((i) => i.id === created.data!.id)?.labelIds).toEqual([label.id]);
    });

    it('rejects an empty title', async () => {
      const { asOwner, columnId } = await setupProject();
      const res = await createIssue(asOwner, columnId, { title: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a missing columnId', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ title: 'No column' } as unknown as { columnId: number; title: string });
      expect(res.status).toBe(400);
    });

    it('returns 404 for an unknown project', async () => {
      const { asOwner, columnId } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'NOPE' })
        .issues.post({ columnId, title: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('get', () => {
    it('returns the issue with its custom field values', async () => {
      const { asOwner, columnId } = await setupProject();
      await asOwner
        .projects({ projectKey: 'MKT' })
        ['custom-fields'].post({ name: 'Severity', fieldType: 'text' });
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner.issues({ issueId: issue.id }).get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: issue.id, title: 'Task' });
      // The project-wide field is listed (unset → value null).
      expect(res.data?.fields.map((f) => f.name)).toContain('Severity');
      expect(res.data?.fields.find((f) => f.name === 'Severity')?.value).toBeNull();
    });

    it('returns 404 for a missing issue', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.issues({ issueId: 999999 }).get();
      expect(res.status).toBe(404);
    });

    it('rejects a non-numeric issue id', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.issues({ issueId: 'abc' as unknown as number }).get();
      expect(res.status).toBe(400);
    });
  });

  // GET /projects/:projectKey/issues/:sequenceNumber resolves an issue by its
  // human number (the identifier-based URL), including archived ones.
  describe('get by number', () => {
    it('returns the issue matching the project-scoped number', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues({ sequenceNumber: issue.sequenceNumber })
        .get();
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: issue.id, identifier: issue.identifier });
    });

    it('resolves an archived issue too', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).archive.post();

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues({ sequenceNumber: issue.sequenceNumber })
        .get();
      expect(res.status).toBe(200);
      expect(res.data?.archivedAt).toBeTruthy();
    });

    it('returns 404 for an unknown number', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues({ sequenceNumber: 999999 })
        .get();
      expect(res.status).toBe(404);
    });
  });

  describe('update', () => {
    it('updates the title', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const patched = await asOwner.issues({ issueId: issue.id }).patch({ title: 'Renamed' });
      expect(patched.status).toBe(200);
      expect(patched.data).toMatchObject({ title: 'Renamed' });

      const read = await asOwner.issues({ issueId: issue.id }).get();
      expect(read.data?.title).toBe('Renamed');
    });

    it('moves the issue to another column', async () => {
      const { asOwner, columnId, columnIds } = await setupProject();
      const target = columnIds[1];
      const issue = (await createIssue(asOwner, columnId)).data!;

      const patched = await asOwner.issues({ issueId: issue.id }).patch({ columnId: target });
      expect(patched.status).toBe(200);
      expect(patched.data?.columnId).toBe(target);
    });

    it('reorders the issue within a column', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const patched = await asOwner.issues({ issueId: issue.id }).patch({ position: 5 });
      expect(patched.status).toBe(200);
      expect(patched.data?.position).toBe(5);
    });

    it('replaces the label set', async () => {
      const { asOwner, columnId } = await setupProject();
      const a = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'a' })).data!;
      const b = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'b' })).data!;
      const issue = (await createIssue(asOwner, columnId, { labelIds: [a.id] })).data!;

      const patched = await asOwner.issues({ issueId: issue.id }).patch({ labelIds: [b.id] });
      expect(patched.status).toBe(200);
      expect(patched.data?.labelIds).toEqual([b.id]);

      const list = await issuesOf(asOwner);
      expect(list.find((i) => i.id === issue.id)?.labelIds).toEqual([b.id]);
    });

    it('changes only the given fields', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId, { title: 'Keep', priority: 'low' }))
        .data!;

      const patched = await asOwner.issues({ issueId: issue.id }).patch({ priority: 'high' });
      expect(patched.data).toMatchObject({ title: 'Keep', priority: 'high' });
    });

    it('returns 404 for a missing issue', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.issues({ issueId: 999999 }).patch({ title: 'Nope' });
      expect(res.status).toBe(404);
    });

    it('rejects an empty title', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const res = await asOwner.issues({ issueId: issue.id }).patch({ title: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a non-numeric issue id', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner
        .issues({ issueId: 'abc' as unknown as number })
        .patch({ title: 'X' });
      expect(res.status).toBe(400);
    });
  });

  describe('delete', () => {
    it('deletes the issue', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const del = await asOwner.issues({ issueId: issue.id }).delete();
      expect(del.status).toBe(204);

      const gone = await asOwner.issues({ issueId: issue.id }).get();
      expect(gone.status).toBe(404);
      const list = await issuesOf(asOwner);
      expect(list.map((i) => i.id)).not.toContain(issue.id);
    });

    it('returns 404 for a missing issue', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.issues({ issueId: 999999 }).delete();
      expect(res.status).toBe(404);
    });
  });

  // POST /issues/:issueId/archive hides the issue from the board (kept, restorable);
  // POST /issues/:issueId/restore brings it back. Archived issues are excluded from
  // the project view's `issues` and listed by GET /projects/:projectKey/issues/archived.
  describe('archive', () => {
    async function archivedOf(client: Api, projectKey = 'MKT') {
      const res = await client.projects({ projectKey }).issues.archived.get();
      return res.data!;
    }

    it('archives an issue: off the board, on the archived list, archivedAt set', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner.issues({ issueId: issue.id }).archive.post();
      expect(res.status).toBe(200);
      expect(res.data?.archivedAt).toBeTruthy();

      expect((await issuesOf(asOwner)).map((i) => i.id)).not.toContain(issue.id);
      expect((await archivedOf(asOwner)).map((i) => i.id)).toContain(issue.id);
    });

    it('restores an archived issue back onto the board', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).archive.post();

      const res = await asOwner.issues({ issueId: issue.id }).restore.post();
      expect(res.status).toBe(200);
      expect(res.data?.archivedAt).toBeNull();

      expect((await issuesOf(asOwner)).map((i) => i.id)).toContain(issue.id);
      expect((await archivedOf(asOwner)).map((i) => i.id)).not.toContain(issue.id);
    });

    it('records an archived entry in the feed', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      await asOwner.issues({ issueId: issue.id }).archive.post();

      const res = await asOwner.issues({ issueId: issue.id }).feed.get({ query: {} });
      expect(res.data?.items.some((i) => i.action === 'archived')).toBe(true);
    });

    it('returns 404 archiving a missing issue', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.issues({ issueId: 999999 }).archive.post();
      expect(res.status).toBe(404);
    });

    it('denies archive to a non-member with 403', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);
      const res = await outsider.issues({ issueId: issue.id }).archive.post();
      expect(res.status).toBe(403);
    });
  });

  // PUT /issues/:issueId/fields/:fieldId sets one custom field's value. Read back
  // through GET /issues/:issueId (the `fields` array).
  describe('custom field values', () => {
    async function fieldValue(client: Api, issueId: number, fieldId: number) {
      const res = await client.issues({ issueId }).get();
      return res.data?.fields.find((f) => f.fieldId === fieldId);
    }

    it('sets a text field value', async () => {
      const { asOwner, columnId } = await setupProject();
      const field = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          ['custom-fields'].post({ name: 'Notes', fieldType: 'text' })
      ).data!;
      const issue = (await createIssue(asOwner, columnId)).data!;

      const put = await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ value: 'hello' });
      expect(put.status).toBe(200);
      expect(put.data).toMatchObject({ ok: true });

      expect((await fieldValue(asOwner, issue.id, field.id))?.value).toBe('hello');
    });

    it("sets a select field's option ids", async () => {
      const { asOwner, columnId } = await setupProject();
      const field = (
        await asOwner.projects({ projectKey: 'MKT' })['custom-fields'].post({
          name: 'Priority',
          fieldType: 'select',
          options: ['Low', 'High'],
        })
      ).data!;
      const optionId = field.options[1].id;
      const issue = (await createIssue(asOwner, columnId)).data!;

      const put = await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ optionIds: [optionId] });
      expect(put.status).toBe(200);

      expect((await fieldValue(asOwner, issue.id, field.id))?.optionIds).toEqual([optionId]);
    });

    it('stores and reads back a number field value', async () => {
      const { asOwner, columnId } = await setupProject();
      const field = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          ['custom-fields'].post({ name: 'Points', fieldType: 'number' })
      ).data!;
      const issue = (await createIssue(asOwner, columnId)).data!;

      const put = await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ value: 8 });
      expect(put.status).toBe(200);

      // The number column stores a string; the store coerces it back to a number.
      expect((await fieldValue(asOwner, issue.id, field.id))?.value).toBe(8);
    });

    it('stores and reads back a boolean field value', async () => {
      const { asOwner, columnId } = await setupProject();
      const field = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          ['custom-fields'].post({ name: 'Done', fieldType: 'boolean' })
      ).data!;
      const issue = (await createIssue(asOwner, columnId)).data!;

      const put = await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ value: true });
      expect(put.status).toBe(200);

      expect((await fieldValue(asOwner, issue.id, field.id))?.value).toBe(true);
    });

    it('clears a field value when set to null', async () => {
      const { asOwner, columnId } = await setupProject();
      const field = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          ['custom-fields'].post({ name: 'Notes', fieldType: 'text' })
      ).data!;
      const issue = (await createIssue(asOwner, columnId)).data!;
      const fields = asOwner.issues({ issueId: issue.id }).fields({ fieldId: field.id });

      await fields.put({ value: 'set' });
      expect((await fieldValue(asOwner, issue.id, field.id))?.value).toBe('set');

      const cleared = await fields.put({ value: null });
      expect(cleared.status).toBe(200);
      expect((await fieldValue(asOwner, issue.id, field.id))?.value).toBeNull();
    });

    it('rejects an invalid number for a number field', async () => {
      const { asOwner, columnId } = await setupProject();
      const field = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          ['custom-fields'].post({ name: 'Points', fieldType: 'number' })
      ).data!;
      const issue = (await createIssue(asOwner, columnId)).data!;

      const put = await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ value: 'not-a-number' });
      expect(put.status).toBe(400);
    });

    it('rejects a non-http url for a url field', async () => {
      const { asOwner, columnId } = await setupProject();
      const field = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          ['custom-fields'].post({ name: 'Link', fieldType: 'url' })
      ).data!;
      const issue = (await createIssue(asOwner, columnId)).data!;

      const put = await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ value: 'javascript:alert(1)' });
      expect(put.status).toBe(400);
    });

    it('rejects a non-numeric field id', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const res = await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: 'abc' as unknown as number })
        .put({ value: 'x' });
      expect(res.status).toBe(400);
    });
  });

  // GET /issues/:issueId/rev is the cheap change marker clients poll for live
  // refresh: an opaque string that must move whenever the issue's detail or feed
  // changes (an edit or a new timeline entry) and stay put otherwise.
  describe('board', () => {
    it('returns the active issues and a string change marker for a member', async () => {
      const { asOwner, columnId } = await setupProject();
      await createIssue(asOwner, columnId, { title: 'Task' });

      const res = await asOwner.projects({ projectKey: 'MKT' }).issues.board.get();
      expect(res.status).toBe(200);
      expect(res.data?.issues).toHaveLength(1);
      expect(res.data?.issues[0]).toMatchObject({ title: 'Task' });
      expect(typeof res.data?.rev).toBe('string');
    });

    it('changes the marker when an issue is added', async () => {
      const { asOwner, columnId } = await setupProject();
      const board = asOwner.projects({ projectKey: 'MKT' }).issues.board;
      const before = (await board.get()).data!.rev;

      await createIssue(asOwner, columnId, { title: 'Task' });

      expect((await board.get()).data!.rev).not.toBe(before);
    });

    it('changes the marker when an initiative is added', async () => {
      const { asOwner } = await setupProject();
      const board = asOwner.projects({ projectKey: 'MKT' }).issues.board;
      const before = (await board.get()).data!.rev;

      await asOwner.projects({ projectKey: 'MKT' }).initiatives.post({ title: 'Q3 Launch' });

      expect((await board.get()).data!.rev).not.toBe(before);
    });

    it('exposes the same marker through the rev endpoint', async () => {
      const { asOwner } = await setupProject();
      const board = (await asOwner.projects({ projectKey: 'MKT' }).issues.board.get()).data!;
      const rev = (await asOwner.projects({ projectKey: 'MKT' }).issues.rev.get()).data!.rev;
      expect(board.rev).toBe(rev);
    });

    it('denies a non-member with 403', async () => {
      await setupProject();
      const outsider = authedApi((await signUpTestUser()).cookie);
      const res = await outsider.projects({ projectKey: 'MKT' }).issues.board.get();
      expect(res.status).toBe(403);
    });
  });

  describe('rev', () => {
    it('returns a change marker for the issue', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner.issues({ issueId: issue.id }).rev.get();
      expect(res.status).toBe(200);
      expect(typeof res.data?.rev).toBe('string');
    });

    it('changes the marker after the issue is updated', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const before = (await asOwner.issues({ issueId: issue.id }).rev.get()).data!.rev;

      await asOwner.issues({ issueId: issue.id }).patch({ title: 'Renamed' });

      const after = (await asOwner.issues({ issueId: issue.id }).rev.get()).data!.rev;
      expect(after).not.toBe(before);
    });

    it('changes the marker after a comment is added', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const before = (await asOwner.issues({ issueId: issue.id }).rev.get()).data!.rev;

      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'note' });

      const after = (await asOwner.issues({ issueId: issue.id }).rev.get()).data!.rev;
      expect(after).not.toBe(before);
    });

    it('returns 404 for a missing issue', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.issues({ issueId: 999999 }).rev.get();
      expect(res.status).toBe(404);
    });

    it('rejects a non-numeric issue id', async () => {
      const { asOwner } = await setupProject();
      const res = await asOwner.issues({ issueId: 'abc' as unknown as number }).rev.get();
      expect(res.status).toBe(400);
    });
  });

  describe('search', () => {
    // GET /projects/:projectKey/issues/search — the light search behind the command
    // palette. Returns IssueSearchHit rows (no description/field values).
    function search(client: Api, query: Record<string, string | number>, projectKey = 'MKT') {
      return client.projects({ projectKey }).issues.search.get({ query });
    }

    it('matches by title and excludes non-matching issues', async () => {
      const { asOwner, columnId } = await setupProject();
      const hit = (await createIssue(asOwner, columnId, { title: 'Zephyr rollout' })).data!;
      await createIssue(asOwner, columnId, { title: 'Unrelated task' });

      const res = await search(asOwner, { q: 'zephyr' });
      expect(res.status).toBe(200);
      expect(res.data!.map((i) => i.id)).toEqual([hit.id]);
      expect(res.data![0]).toMatchObject({ identifier: hit.identifier, archived: false });
    });

    it('matches by description', async () => {
      const { asOwner, columnId } = await setupProject();
      const hit = (
        await createIssue(asOwner, columnId, {
          title: 'Plain',
          description: 'contains quokka word',
        })
      ).data!;
      await createIssue(asOwner, columnId, { title: 'Other' });

      const res = await search(asOwner, { q: 'quokka' });
      expect(res.data!.map((i) => i.id)).toEqual([hit.id]);
    });

    it('always includes archived issues, flagged as archived', async () => {
      const { asOwner, columnId } = await setupProject();
      const hit = (await createIssue(asOwner, columnId, { title: 'Zephyr rollout' })).data!;
      await asOwner.issues({ issueId: hit.id }).archive.post();

      const res = await search(asOwner, { q: 'zephyr' });
      expect(res.status).toBe(200);
      expect(res.data!.map((i) => i.id)).toEqual([hit.id]);
      expect(res.data![0]).toMatchObject({ archived: true });
    });

    it('matches by issue number, plainly and as KEY-42, but not another key', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId, { title: 'Numbered' })).data!;
      const seq = issue.sequenceNumber;

      expect((await search(asOwner, { q: String(seq) })).data!.map((i) => i.id)).toContain(
        issue.id,
      );
      expect((await search(asOwner, { q: `MKT-${seq}` })).data!.map((i) => i.id)).toContain(
        issue.id,
      );
      // A different project key does not match the number.
      expect((await search(asOwner, { q: `OTHER-${seq}` })).data!.map((i) => i.id)).not.toContain(
        issue.id,
      );
    });

    it('matches by a scalar custom field text value', async () => {
      const { asOwner, columnId } = await setupProject();
      const field = (
        await asOwner.projects({ projectKey: 'MKT' })['custom-fields'].post({
          name: 'Notes',
          fieldType: 'text',
        })
      ).data!;
      const issue = (await createIssue(asOwner, columnId, { title: 'Plain title' })).data!;
      await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ value: 'narwhal note' });

      const res = await search(asOwner, { q: 'narwhal' });
      expect(res.data!.map((i) => i.id)).toEqual([issue.id]);
    });

    it('matches by a select option label', async () => {
      const { asOwner, columnId } = await setupProject();
      const field = (
        await asOwner.projects({ projectKey: 'MKT' })['custom-fields'].post({
          name: 'Severity',
          fieldType: 'select',
          options: ['Trivial', 'Critical'],
        })
      ).data!;
      const issue = (await createIssue(asOwner, columnId, { title: 'Plain title' })).data!;
      await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ optionIds: [field.options[1].id] });

      const res = await search(asOwner, { q: 'critical' });
      expect(res.data!.map((i) => i.id)).toEqual([issue.id]);
    });

    it('caps the result count at limit', async () => {
      const { asOwner, columnId } = await setupProject();
      for (let i = 0; i < 3; i++) await createIssue(asOwner, columnId, { title: `Item ${i}` });

      const res = await search(asOwner, { q: 'item', limit: 2 });
      expect(res.data!.length).toBe(2);
    });

    it('matches LIKE metacharacters literally', async () => {
      const { asOwner, columnId } = await setupProject();
      const hit = (await createIssue(asOwner, columnId, { title: '50% off deal' })).data!;
      await createIssue(asOwner, columnId, { title: 'no discount' });

      const res = await search(asOwner, { q: '50%' });
      expect(res.data!.map((i) => i.id)).toEqual([hit.id]);
    });

    it('does not find issues from another project', async () => {
      const { asOwner, columnId } = await setupProject();
      await createIssue(asOwner, columnId, { title: 'Kestrel here' });
      await asOwner.projects.post({ key: 'OPS', name: 'Ops' });
      const opsCols = (await asOwner.projects({ projectKey: 'OPS' }).get()).data!.columns;
      await asOwner
        .projects({ projectKey: 'OPS' })
        .issues.post({ columnId: opsCols[0].id, title: 'Kestrel there' });

      const res = await search(asOwner, { q: 'kestrel' });
      expect(res.data!.every((i) => i.identifier.startsWith('MKT-'))).toBe(true);
      expect(res.data!.length).toBe(1);
    });

    it('denies a non-member', async () => {
      const { asOwner, columnId } = await setupProject();
      await createIssue(asOwner, columnId, { title: 'Secret' });
      const outsider = authedApi((await signUpTestUser()).cookie);

      expect((await search(outsider, { q: 'secret' })).status).toBe(403);
    });
  });

  describe('list (filters)', () => {
    // GET /projects/:projectKey/issues — the filtered list (no text query). Same
    // IssueSearchHit rows as search.
    function list(client: Api, query: Record<string, string | number> = {}, projectKey = 'MKT') {
      return client.projects({ projectKey }).issues.get({ query });
    }

    it('lists active issues by default and excludes archived', async () => {
      const { asOwner, columnId } = await setupProject();
      const active = (await createIssue(asOwner, columnId, { title: 'Active' })).data!;
      const gone = (await createIssue(asOwner, columnId, { title: 'Archived one' })).data!;
      await asOwner.issues({ issueId: gone.id }).archive.post();

      const res = await list(asOwner);
      expect(res.status).toBe(200);
      const ids = res.data!.map((i) => i.id);
      expect(ids).toContain(active.id);
      expect(ids).not.toContain(gone.id);
    });

    it('includes archived when includeArchived is set', async () => {
      const { asOwner, columnId } = await setupProject();
      const gone = (await createIssue(asOwner, columnId, { title: 'Archived one' })).data!;
      await asOwner.issues({ issueId: gone.id }).archive.post();

      const res = await list(asOwner, { includeArchived: 'true' });
      expect(res.data!.map((i) => i.id)).toContain(gone.id);
      expect(res.data!.find((i) => i.id === gone.id)?.archived).toBe(true);
    });

    it('filters by column id', async () => {
      const { asOwner, columnId, columnIds } = await setupProject();
      const here = (await createIssue(asOwner, columnId, { title: 'Here' })).data!;
      await createIssue(asOwner, columnIds[1], { title: 'Elsewhere' });

      const res = await list(asOwner, { columnId });
      expect(res.data!.map((i) => i.id)).toContain(here.id);
      expect(res.data!.every((i) => i.columnId === columnId)).toBe(true);
    });

    it('applies the labelIds filter with AND semantics', async () => {
      const { asOwner, columnId } = await setupProject();
      const a = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'a' })).data!;
      const b = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'b' })).data!;
      const both = (await createIssue(asOwner, columnId, { title: 'Both', labelIds: [a.id, b.id] }))
        .data!;
      const onlyA = (await createIssue(asOwner, columnId, { title: 'OnlyA', labelIds: [a.id] }))
        .data!;

      const res = await list(asOwner, { labelIds: `${a.id},${b.id}` });
      const ids = res.data!.map((i) => i.id);
      expect(ids).toContain(both.id);
      expect(ids).not.toContain(onlyA.id);
    });

    it('ignores placeholder 0 ids and empty strings (LLM-filled defaults)', async () => {
      const { asOwner, columnId } = await setupProject();
      const one = (await createIssue(asOwner, columnId, { title: 'Real one' })).data!;

      // A tool-calling model tends to fill every optional field: 0 for numeric ids,
      // "" for strings. These must mean "any", not a filter on id 0 / empty priority.
      const res = await list(asOwner, {
        columnId: 0,
        typeId: 0,
        initiativeId: 0,
        priority: '',
      });
      expect(res.status).toBe(200);
      expect(res.data!.map((i) => i.id)).toContain(one.id);
    });

    it('denies a non-member', async () => {
      const { asOwner, columnId } = await setupProject();
      await createIssue(asOwner, columnId, { title: 'Secret' });
      const outsider = authedApi((await signUpTestUser()).cookie);

      expect((await list(outsider)).status).toBe(403);
    });
  });

  describe('bulk actions', () => {
    it('applies one patch to every listed issue', async () => {
      const { asOwner, columnId, columnIds } = await setupProject();
      const a = (await createIssue(asOwner, columnId)).data!;
      const b = (await createIssue(asOwner, columnId)).data!;
      const target = columnIds[2];

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.patch({ ids: [a.id, b.id], patch: { columnId: target } });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ updated: 2 });

      const list = await issuesOf(asOwner);
      expect(list.find((i) => i.id === a.id)?.columnId).toBe(target);
      expect(list.find((i) => i.id === b.id)?.columnId).toBe(target);
    });

    it('adds labels to every listed issue, keeping existing ones', async () => {
      const { asOwner, columnId } = await setupProject();
      const a = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'a' })).data!;
      const b = (await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'b' })).data!;
      const one = (await createIssue(asOwner, columnId, { labelIds: [a.id] })).data!;
      const two = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.labels.post({ ids: [one.id, two.id], add: [b.id] });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ updated: 2 });

      const list = await issuesOf(asOwner);
      expect(list.find((i) => i.id === one.id)?.labelIds.sort()).toEqual([a.id, b.id].sort());
      expect(list.find((i) => i.id === two.id)?.labelIds).toEqual([b.id]);
    });

    it('archives every listed issue', async () => {
      const { asOwner, columnId } = await setupProject();
      const a = (await createIssue(asOwner, columnId)).data!;
      const b = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.archive.post({ ids: [a.id, b.id] });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ archived: 2 });

      const list = await issuesOf(asOwner);
      expect(list.map((i) => i.id)).not.toContain(a.id);
      expect(list.map((i) => i.id)).not.toContain(b.id);
    });

    it('deletes every listed issue', async () => {
      const { asOwner, columnId } = await setupProject();
      const a = (await createIssue(asOwner, columnId)).data!;
      const b = (await createIssue(asOwner, columnId)).data!;

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.delete.post({ ids: [a.id, b.id] });
      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ deleted: 2 });

      expect((await asOwner.issues({ issueId: a.id }).get()).status).toBe(404);
      expect((await asOwner.issues({ issueId: b.id }).get()).status).toBe(404);
    });

    it('ignores ids that belong to another project', async () => {
      const { asOwner, columnId } = await setupProject();
      const mine = (await createIssue(asOwner, columnId)).data!;
      // A second project owned by the same user; its issue must not be touched by a
      // bulk action scoped to the first project.
      await asOwner.projects.post({ key: 'OPS', name: 'Ops' });
      const opsColumn = (await asOwner.projects({ projectKey: 'OPS' }).get()).data!.columns[0].id;
      const foreign = (
        await asOwner
          .projects({ projectKey: 'OPS' })
          .issues.post({ columnId: opsColumn, title: 'X' })
      ).data!;

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.archive.post({ ids: [mine.id, foreign.id] });
      expect(res.data).toMatchObject({ archived: 1 });

      // The foreign issue is still on its own board.
      expect((await issuesOf(asOwner, 'OPS')).map((i) => i.id)).toContain(foreign.id);
    });

    it('rejects an empty id list', async () => {
      const { asOwner } = await setupProject();

      const res = await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.bulk.patch({ ids: [], patch: { priority: 'high' } });
      expect(res.status).toBe(400);
    });

    it('denies a non-member', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);

      expect(
        (
          await outsider
            .projects({ projectKey: 'MKT' })
            .issues.bulk.patch({ ids: [issue.id], patch: { priority: 'high' } })
        ).status,
      ).toBe(403);
      expect(
        (
          await outsider
            .projects({ projectKey: 'MKT' })
            .issues.bulk.delete.post({ ids: [issue.id] })
        ).status,
      ).toBe(403);
    });
  });

  describe('access', () => {
    it('denies a non-member on every issue route', async () => {
      const { asOwner, columnId } = await setupProject();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const outsider = authedApi((await signUpTestUser()).cookie);

      // Guard-thrown 403 is not in Treaty's inferred error-status union, so assert
      // the top-level HTTP status rather than error.status.
      expect(
        (await outsider.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'X' }))
          .status,
      ).toBe(403);
      expect((await outsider.issues({ issueId: issue.id }).get()).status).toBe(403);
      expect((await outsider.issues({ issueId: issue.id }).patch({ title: 'X' })).status).toBe(403);
      expect((await outsider.issues({ issueId: issue.id }).delete()).status).toBe(403);
      expect((await outsider.issues({ issueId: issue.id }).rev.get()).status).toBe(403);
    });
  });
});
