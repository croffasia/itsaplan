import { describe, it, expect, beforeEach } from 'bun:test';
import { api, authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// GET /sync/rev is the one poll behind live refresh: it answers with the change
// marker of every scope a client watches. The markers are written by database
// triggers, so what these tests really check is that each write reaches the scope
// that shows it — and that a scope of a project the caller is not in stays silent.

interface Setup {
  asOwner: Api;
  userId: string;
  projectId: number;
  columnId: number;
}

async function setup(key = 'MKT'): Promise<Setup> {
  const u = await signUpTestUser();
  const asOwner = authedApi(u.cookie);
  await asOwner.projects.post({ key, name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: key }).get();
  return {
    asOwner,
    userId: u.userId,
    projectId: view.data!.project.id,
    columnId: view.data!.columns[0].id,
  };
}

function createIssue(client: Api, columnId: number, patch: Record<string, unknown> = {}) {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task', ...patch });
}

// Adds a member to MKT through the real invite flow.
async function addMember(asOwner: Api): Promise<{ userId: string; api: Api }> {
  const user = await signUpTestUser();
  const invite = await asOwner
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: user.email, role: 'member' });
  const api = authedApi(user.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  return { userId: user.userId, api };
}

async function revs(client: Api, scopes: string): Promise<Record<string, string>> {
  const res = await client.sync.rev.get({ query: { scopes } });
  expect(res.status).toBe(200);
  return res.data!.revs;
}

async function rev(client: Api, scope: string): Promise<string> {
  return (await revs(client, scope))[scope];
}

describe('sync', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('scopes', () => {
    it('reads several scopes in one request', async () => {
      const { asOwner, projectId, columnId } = await setup();
      const issue = (await createIssue(asOwner, columnId)).data!;

      const all = await revs(asOwner, `board:${projectId},issue:${issue.id},inbox:${projectId}`);
      expect(Object.keys(all).sort()).toEqual(
        [`board:${projectId}`, `inbox:${projectId}`, `issue:${issue.id}`].sort(),
      );
    });

    it('reads a scope nothing has touched yet as "0"', async () => {
      const { asOwner, projectId } = await setup();
      expect(await rev(asOwner, `inbox:${projectId}`)).toBe('0');
    });

    it('rejects an unknown scope kind', async () => {
      const { asOwner, projectId } = await setup();
      const res = await asOwner.sync.rev.get({ query: { scopes: `widget:${projectId}` } });
      expect(res.status).toBe(400);
    });

    it('rejects a scope without a numeric id', async () => {
      const { asOwner } = await setup();
      const res = await asOwner.sync.rev.get({ query: { scopes: 'board:abc' } });
      expect(res.status).toBe(400);
    });

    it('rejects a kind that is only an inherited property name', async () => {
      const { asOwner } = await setup();
      const res = await asOwner.sync.rev.get({ query: { scopes: '__proto__:1' } });
      expect(res.status).toBe(400);
    });

    it('rejects more scopes than the limit', async () => {
      const { asOwner, projectId } = await setup();
      const scopes = Array.from({ length: 21 }, () => `board:${projectId}`).join(',');
      const res = await asOwner.sync.rev.get({ query: { scopes } });
      expect(res.status).toBe(400);
    });
  });

  describe('board scope', () => {
    it('moves when an issue is created, edited, archived and deleted', async () => {
      const { asOwner, projectId, columnId } = await setup();
      const board = `board:${projectId}`;

      const empty = await rev(asOwner, board);
      const issue = (await createIssue(asOwner, columnId)).data!;
      const created = await rev(asOwner, board);
      expect(created).not.toBe(empty);

      await asOwner.issues({ issueId: issue.id }).patch({ title: 'Renamed' });
      const edited = await rev(asOwner, board);
      expect(edited).not.toBe(created);

      await asOwner.issues({ issueId: issue.id }).archive.post();
      const archived = await rev(asOwner, board);
      expect(archived).not.toBe(edited);

      await asOwner.issues({ issueId: issue.id }).delete();
      expect(await rev(asOwner, board)).not.toBe(archived);
    });

    it('moves when a label is attached to an issue', async () => {
      const { asOwner, projectId, columnId } = await setup();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const label = (
        await asOwner.projects({ projectKey: 'MKT' }).labels.post({ name: 'bug', color: '#f00' })
      ).data!;
      const before = await rev(asOwner, `board:${projectId}`);

      await asOwner.issues({ issueId: issue.id }).patch({ labelIds: [label.id] });

      expect(await rev(asOwner, `board:${projectId}`)).not.toBe(before);
    });

    it('moves when a relation between two issues is added and removed', async () => {
      const { asOwner, projectId, columnId } = await setup();
      const a = (await createIssue(asOwner, columnId, { title: 'A' })).data!;
      const b = (await createIssue(asOwner, columnId, { title: 'B' })).data!;
      const before = await rev(asOwner, `board:${projectId}`);

      const link = (
        await asOwner.issues({ issueId: a.id }).links.post({ targetIssueId: b.id, kind: 'blocks' })
      ).data!;
      const linked = await rev(asOwner, `board:${projectId}`);
      expect(linked).not.toBe(before);

      await asOwner.issues({ issueId: a.id }).links({ linkId: link.id }).delete();
      expect(await rev(asOwner, `board:${projectId}`)).not.toBe(linked);
    });

    it('moves when an initiative or a cycle changes', async () => {
      const { asOwner, projectId } = await setup();
      const board = `board:${projectId}`;
      const before = await rev(asOwner, board);

      const initiative = (
        await asOwner.projects({ projectKey: 'MKT' }).initiatives.post({ title: 'Q3' })
      ).data!;
      const afterInitiative = await rev(asOwner, board);
      expect(afterInitiative).not.toBe(before);

      await asOwner.initiatives({ initiativeId: initiative.id }).patch({ title: 'Q4' });
      const afterRename = await rev(asOwner, board);
      expect(afterRename).not.toBe(afterInitiative);

      await asOwner
        .projects({ projectKey: 'MKT' })
        .cycles.post({ name: 'Sprint 1', startDate: '2026-01-01', endDate: '2026-01-14' });
      expect(await rev(asOwner, board)).not.toBe(afterRename);
    });

    it('stays put when only an issue comment is added', async () => {
      const { asOwner, projectId, columnId } = await setup();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const before = await rev(asOwner, `board:${projectId}`);

      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'note' });

      expect(await rev(asOwner, `board:${projectId}`)).toBe(before);
    });
  });

  describe('issue scope', () => {
    it('moves on an edit and on a comment', async () => {
      const { asOwner, columnId } = await setup();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const scope = `issue:${issue.id}`;

      const created = await rev(asOwner, scope);
      await asOwner.issues({ issueId: issue.id }).patch({ title: 'Renamed' });
      const edited = await rev(asOwner, scope);
      expect(edited).not.toBe(created);

      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'note' });
      expect(await rev(asOwner, scope)).not.toBe(edited);
    });

    it('moves when a custom field value is set', async () => {
      const { asOwner, columnId } = await setup();
      const issue = (await createIssue(asOwner, columnId)).data!;
      const field = (
        await asOwner
          .projects({ projectKey: 'MKT' })
          ['custom-fields'].post({ name: 'Impact', fieldType: 'text' })
      ).data!;
      const before = await rev(asOwner, `issue:${issue.id}`);

      await asOwner
        .issues({ issueId: issue.id })
        .fields({ fieldId: field.id })
        .put({ value: 'hi' });

      expect(await rev(asOwner, `issue:${issue.id}`)).not.toBe(before);
    });

    it('is dropped when the issue is deleted', async () => {
      const { asOwner, columnId } = await setup();
      const issue = (await createIssue(asOwner, columnId)).data!;
      expect(await rev(asOwner, `issue:${issue.id}`)).not.toBe('0');

      const res = await asOwner.issues({ issueId: issue.id }).delete();
      expect(res.status).toBe(204);

      expect(await rev(asOwner, `issue:${issue.id}`)).toBe('0');
    });
  });

  describe('initiative scope', () => {
    it('moves on its own edit and on activity of an issue it holds', async () => {
      const { asOwner, columnId } = await setup();
      const initiative = (
        await asOwner.projects({ projectKey: 'MKT' }).initiatives.post({ title: 'Q3' })
      ).data!;
      const scope = `initiative:${initiative.id}`;

      const created = await rev(asOwner, scope);
      await asOwner.initiatives({ initiativeId: initiative.id }).patch({ status: 'active' });
      const edited = await rev(asOwner, scope);
      expect(edited).not.toBe(created);

      const issue = (await createIssue(asOwner, columnId, { initiativeId: initiative.id })).data!;
      const linked = await rev(asOwner, scope);
      expect(linked).not.toBe(edited);

      await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'note' });
      expect(await rev(asOwner, scope)).not.toBe(linked);
    });

    it('moves for both initiatives when an issue is moved between them', async () => {
      const { asOwner, columnId } = await setup();
      const initiatives = asOwner.projects({ projectKey: 'MKT' }).initiatives;
      const from = (await initiatives.post({ title: 'Q3' })).data!;
      const to = (await initiatives.post({ title: 'Q4' })).data!;
      const issue = (await createIssue(asOwner, columnId, { initiativeId: from.id })).data!;
      const scopes = `initiative:${from.id},initiative:${to.id}`;
      const before = await revs(asOwner, scopes);

      await asOwner.issues({ issueId: issue.id }).patch({ initiativeId: to.id });

      const after = await revs(asOwner, scopes);
      expect(after[`initiative:${from.id}`]).not.toBe(before[`initiative:${from.id}`]);
      expect(after[`initiative:${to.id}`]).not.toBe(before[`initiative:${to.id}`]);
    });
  });

  describe('documents scope', () => {
    it('moves for document, preference, and asset changes', async () => {
      const { asOwner, projectId } = await setup();
      const scope = `documents:${projectId}`;
      const initial = await rev(asOwner, scope);
      const documents = asOwner.projects({ projectKey: 'MKT' }).documents;

      const page = (await documents.post({ title: 'Handbook' })).data!;
      const created = await rev(asOwner, scope);
      expect(created).not.toBe(initial);

      await documents({ documentId: page.id }).patch({ version: page.version, content: 'Updated' });
      const edited = await rev(asOwner, scope);
      expect(edited).not.toBe(created);

      await documents({ documentId: page.id }).preferences.patch({ isFavorite: true });
      const favorited = await rev(asOwner, scope);
      expect(favorited).not.toBe(edited);

      const asset = await documents({ documentId: page.id }).assets.post({
        file: new File(['diagram'], 'diagram.png', { type: 'image/png' }),
      });
      const uploaded = await rev(asOwner, scope);
      expect(uploaded).not.toBe(favorited);

      await documents({ documentId: page.id }).assets({ publicId: asset.data!.id }).delete();
      expect(await rev(asOwner, scope)).not.toBe(uploaded);
    });
  });

  describe('inbox scope', () => {
    it("moves for the notified user only, and not for someone else's inbox", async () => {
      const { asOwner, projectId, columnId } = await setup();
      const { userId, api: asMember } = await addMember(asOwner);

      const scope = `inbox:${projectId}`;
      const ownerBefore = await rev(asOwner, scope);
      const memberBefore = await rev(asMember, scope);

      await createIssue(asOwner, columnId, { assigneeUserId: userId });

      // The same scope string, but each session reads its own inbox: only the
      // assignee was notified.
      expect(await rev(asMember, scope)).not.toBe(memberBefore);
      expect(await rev(asOwner, scope)).toBe(ownerBefore);
    });

    it('moves when a notification is read', async () => {
      const { asOwner, projectId, columnId } = await setup();
      const { userId, api: asMember } = await addMember(asOwner);
      await createIssue(asOwner, columnId, { assigneeUserId: userId });

      const before = await rev(asMember, `inbox:${projectId}`);
      const inbox = await asMember.notifications.get({ query: {} });
      await asMember
        .notifications({ id: inbox.data!.items[0].id })
        .read.post({ read: true } as never);

      expect(await rev(asMember, `inbox:${projectId}`)).not.toBe(before);
    });
  });

  describe('access', () => {
    it('reads a non-member\'s project as "0"', async () => {
      const { asOwner, projectId, columnId } = await setup();
      await createIssue(asOwner, columnId);
      expect(await rev(asOwner, `board:${projectId}`)).not.toBe('0');

      const outsider = authedApi((await signUpTestUser()).cookie);
      expect(await rev(outsider, `board:${projectId}`)).toBe('0');
    });

    it('reads a scope the member\'s role may not see as "0"', async () => {
      const { asOwner, projectId, columnId } = await setup();
      await createIssue(asOwner, columnId);
      const { userId, api: asMember } = await addMember(asOwner);
      const board = `board:${projectId}`;
      expect(await rev(asMember, board)).not.toBe('0');

      // A role that grants nothing, work items included.
      const role = (
        await asOwner.projects({ projectKey: 'MKT' }).roles.post({ name: 'Guest', permissions: {} })
      ).data!;
      await asOwner
        .projects({ projectKey: 'MKT' })
        .members({ userId })
        .patch({ role: 'member', roleId: role.id });

      expect(await rev(asMember, board)).toBe('0');
    });

    it('hides a documents scope from a member without documents read access', async () => {
      const { asOwner, projectId } = await setup();
      await asOwner.projects({ projectKey: 'MKT' }).documents.post({ title: 'Handbook' });
      const { userId, api: asMember } = await addMember(asOwner);
      const scope = `documents:${projectId}`;
      expect(await rev(asMember, scope)).not.toBe('0');

      const role = (
        await asOwner.projects({ projectKey: 'MKT' }).roles.post({
          name: 'Work items only',
          permissions: { work_items: { read: true } },
        })
      ).data!;
      await asOwner
        .projects({ projectKey: 'MKT' })
        .members({ userId })
        .patch({ role: 'member', roleId: role.id });

      expect(await rev(asMember, scope)).toBe('0');
    });

    it('requires a session', async () => {
      const { projectId } = await setup();
      const res = await api.sync.rev.get({ query: { scopes: `board:${projectId}` } });
      expect(res.status).toBe(401);
    });
  });

  describe('project delete', () => {
    it('removes the markers of the deleted project', async () => {
      const { asOwner, projectId, columnId } = await setup();
      const issue = (await createIssue(asOwner, columnId)).data!;
      expect(await rev(asOwner, `board:${projectId}`)).not.toBe('0');

      const res = await asOwner.projects({ projectKey: 'MKT' }).delete();
      expect(res.status).toBe(204);

      // A fresh project with the same key gets fresh markers: the caller is a member
      // again, so a leftover row would show up here.
      await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
      const view = await asOwner.projects({ projectKey: 'MKT' }).get();
      expect(await rev(asOwner, `board:${view.data!.project.id}`)).toBe('0');
      expect(await rev(asOwner, `issue:${issue.id}`)).toBe('0');
    });
  });
});
