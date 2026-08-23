import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Who follows an issue. A watcher receives the notifications the issue produces;
// the list comes back with the issue (GET /issues/:issueId → `watchers`) and is
// changed through POST/DELETE /issues/:issueId/watch, which act on the caller
// only. Members are subscribed automatically when they create an issue, are
// assigned one, comment on it or are mentioned in it — unless they turned
// auto-subscribe off, and never once they have unwatched it by hand.

interface Member {
  api: Api;
  userId: string;
  username: string;
}

async function setup(): Promise<{ owner: Member; columnId: number }> {
  const u = await signUpTestUser();
  const api = authedApi(u.cookie);
  await api.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await api.projects({ projectKey: 'MKT' }).get();
  return {
    owner: { api, userId: u.userId, username: u.username },
    columnId: view.data!.columns[0].id,
  };
}

async function addMember(owner: Member): Promise<Member> {
  const u = await signUpTestUser();
  const invite = await owner.api
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: u.email, role: 'member' });
  const api = authedApi(u.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  return { api, userId: u.userId, username: u.username };
}

function createIssue(client: Api, columnId: number, patch: Record<string, unknown> = {}) {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task', ...patch });
}

async function watcherIds(client: Api, issueId: number): Promise<string[]> {
  const res = await client.issues({ issueId }).get();
  return res.data!.watchers.map((w) => w.userId);
}

describe('issue watchers', () => {
  beforeEach(resetDb);

  describe('auto-subscribe', () => {
    it('subscribes the author and the assignee', async () => {
      const { owner, columnId } = await setup();
      const member = await addMember(owner);

      const issue = await createIssue(owner.api, columnId, { assigneeUserId: member.userId });

      const ids = await watcherIds(owner.api, issue.data!.id);
      expect(ids.sort()).toEqual([owner.userId, member.userId].sort());
    });

    it('keeps the previous assignee subscribed when the issue is handed on', async () => {
      const { owner, columnId } = await setup();
      const first = await addMember(owner);
      const second = await addMember(owner);
      const issue = await createIssue(owner.api, columnId, { assigneeUserId: first.userId });

      await owner.api.issues({ issueId: issue.data!.id }).patch({ assigneeUserId: second.userId });

      const ids = await watcherIds(owner.api, issue.data!.id);
      expect(ids).toContain(first.userId);
      expect(ids).toContain(second.userId);
    });

    it('subscribes a member who comments', async () => {
      const { owner, columnId } = await setup();
      const member = await addMember(owner);
      const issue = await createIssue(owner.api, columnId);

      await member.api.issues({ issueId: issue.data!.id }).comments.post({ body: 'on it' });

      expect(await watcherIds(owner.api, issue.data!.id)).toContain(member.userId);
    });

    it('subscribes a member who is mentioned', async () => {
      const { owner, columnId } = await setup();
      const member = await addMember(owner);
      const issue = await createIssue(owner.api, columnId);

      await owner.api
        .issues({ issueId: issue.data!.id })
        .comments.post({ body: `@${member.username} take a look` });

      expect(await watcherIds(owner.api, issue.data!.id)).toContain(member.userId);
    });

    it('leaves out a member who turned auto-subscribe off', async () => {
      const { owner, columnId } = await setup();
      const member = await addMember(owner);
      await member.api.account.preferences.patch({ autoWatch: false });
      const issue = await createIssue(owner.api, columnId);

      await member.api.issues({ issueId: issue.data!.id }).comments.post({ body: 'on it' });

      expect(await watcherIds(owner.api, issue.data!.id)).not.toContain(member.userId);
    });
  });

  describe('watch and unwatch', () => {
    it('subscribes the caller and returns the list', async () => {
      const { owner, columnId } = await setup();
      const member = await addMember(owner);
      const issue = await createIssue(owner.api, columnId);

      const res = await member.api.issues({ issueId: issue.data!.id }).watch.post();

      expect(res.status).toBe(200);
      expect(res.data!.map((w) => w.userId).sort()).toEqual([owner.userId, member.userId].sort());
      expect(await watcherIds(owner.api, issue.data!.id)).toContain(member.userId);
    });

    it('unsubscribes the caller', async () => {
      const { owner, columnId } = await setup();
      const issue = await createIssue(owner.api, columnId);

      const res = await owner.api.issues({ issueId: issue.data!.id }).watch.delete();

      expect(res.status).toBe(200);
      expect(res.data).toEqual([]);
    });

    it('keeps an unsubscription when the member acts on the issue again', async () => {
      const { owner, columnId } = await setup();
      const issue = await createIssue(owner.api, columnId);
      await owner.api.issues({ issueId: issue.data!.id }).watch.delete();

      await owner.api.issues({ issueId: issue.data!.id }).comments.post({ body: 'still here' });

      expect(await watcherIds(owner.api, issue.data!.id)).toEqual([]);
    });

    it('subscribes again after an unsubscription', async () => {
      const { owner, columnId } = await setup();
      const issue = await createIssue(owner.api, columnId);
      await owner.api.issues({ issueId: issue.data!.id }).watch.delete();

      await owner.api.issues({ issueId: issue.data!.id }).watch.post();

      expect(await watcherIds(owner.api, issue.data!.id)).toEqual([owner.userId]);
    });

    it('rejects a non-member', async () => {
      const { owner, columnId } = await setup();
      const outsider = await signUpTestUser();
      const issue = await createIssue(owner.api, columnId);

      const res = await authedApi(outsider.cookie).issues({ issueId: issue.data!.id }).watch.post();

      expect(res.status).toBe(403);
    });

    it('is a 404 for an issue that does not exist', async () => {
      const { owner } = await setup();

      const res = await owner.api.issues({ issueId: 999999 }).watch.post();

      expect(res.status).toBe(404);
    });
  });

  describe('notifications', () => {
    it('notifies a watcher of a status change, and stops once they unwatch', async () => {
      const { owner, columnId } = await setup();
      const member = await addMember(owner);
      const view = await owner.api.projects({ projectKey: 'MKT' }).get();
      const columns = view.data!.columns;
      const issue = await createIssue(owner.api, columnId);
      const issueId = issue.data!.id;
      await member.api.issues({ issueId }).watch.post();

      await owner.api.issues({ issueId }).patch({ columnId: columns[1].id });
      const first = await member.api.notifications.get({ query: { types: 'state_changed' } });
      expect(first.data!.items).toHaveLength(1);

      await member.api.issues({ issueId }).watch.delete();
      await owner.api.issues({ issueId }).patch({ columnId: columns[2].id });

      const after = await member.api.notifications.get({ query: { types: 'state_changed' } });
      expect(after.data!.items).toHaveLength(1);
    });

    it('notifies a mentioned member who does not watch the issue', async () => {
      const { owner, columnId } = await setup();
      const member = await addMember(owner);
      const issue = await createIssue(owner.api, columnId);
      const issueId = issue.data!.id;
      await member.api.issues({ issueId }).watch.delete();

      await owner.api.issues({ issueId }).comments.post({ body: `@${member.username} look` });

      const inbox = await member.api.notifications.get({ query: { types: 'mentioned' } });
      expect(inbox.data!.items).toHaveLength(1);
    });
  });
});
