import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// Notifications are fanned out when an issue changes and read back through the
// session user's inbox. The actor is never notified about their own action, and
// only project members receive notifications. New members join through invites, so
// a second member is added by creating and accepting an invite.

interface Member {
  api: Api;
  userId: string;
}

async function setup(): Promise<{ owner: Member; columnId: number; doneColumnId: number }> {
  const u = await signUpTestUser();
  const api = authedApi(u.cookie);
  await api.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await api.projects({ projectKey: 'MKT' }).get();
  const columns = view.data!.columns;
  const done = columns.find((c) => c.stateType === 'completed') ?? columns[columns.length - 1];
  return { owner: { api, userId: u.userId }, columnId: columns[0].id, doneColumnId: done.id };
}

async function addMember(owner: Member): Promise<Member> {
  const u = await signUpTestUser();
  const invite = await owner.api
    .projects({ projectKey: 'MKT' })
    .invites.post({ email: u.email, role: 'member' });
  const api = authedApi(u.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  return { api, userId: u.userId };
}

function createIssue(client: Api, columnId: number, patch: Record<string, unknown> = {}) {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task', ...patch });
}

describe('notifications', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('notifies the new assignee, not the actor', async () => {
    const { owner, columnId } = await setup();
    const member = await addMember(owner);

    await createIssue(owner.api, columnId, {
      title: 'Ship it',
      assigneeUserId: member.userId,
    });

    const inbox = await member.api.notifications.get({ query: {} });
    expect(inbox.status).toBe(200);
    expect(inbox.data!.items).toHaveLength(1);
    expect(inbox.data!.items[0]).toMatchObject({
      type: 'assigned',
      actorUserId: owner.userId,
      issueTitle: 'Ship it',
      projectKey: 'MKT',
      readAt: null,
    });

    // The actor is not notified about their own action.
    const ownerInbox = await owner.api.notifications.get({ query: {} });
    expect(ownerInbox.data!.items).toHaveLength(0);
  });

  it('notifies participants on a comment', async () => {
    const { owner, columnId } = await setup();
    const member = await addMember(owner);

    // Owner creates the issue assigned to member (owner is now a participant via
    // the create/assign activity; member via assignment).
    const issue = await createIssue(owner.api, columnId, { assigneeUserId: member.userId });
    const issueId = issue.data!.id;

    // Member comments -> owner (a participant) gets a 'commented' notification.
    await owner.api.issues({ issueId }).comments.post({ body: 'looking into it' } as never);
    await member.api.issues({ issueId }).comments.post({ body: 'done' } as never);

    const ownerInbox = await owner.api.notifications.get({ query: { types: 'commented' } });
    expect(ownerInbox.data!.items).toHaveLength(1);
    expect(ownerInbox.data!.items[0]).toMatchObject({
      type: 'commented',
      actorUserId: member.userId,
    });
  });

  it('rev and unread count track reads', async () => {
    const { owner, columnId } = await setup();
    const member = await addMember(owner);
    await createIssue(owner.api, columnId, { assigneeUserId: member.userId });

    const rev1 = await member.api.notifications.rev.get();
    expect(rev1.data!.unread).toBe(1);

    const inbox = await member.api.notifications.get({ query: {} });
    const id = inbox.data!.items[0].id;
    const read = await member.api.notifications({ id }).read.post({ read: true } as never);
    expect(read.status).toBe(204);

    const rev2 = await member.api.notifications.rev.get();
    expect(rev2.data!.unread).toBe(0);
    expect(rev2.data!.rev).not.toBe(rev1.data!.rev);

    // includeRead=false hides the now-read notification.
    const unreadOnly = await member.api.notifications.get({ query: { includeRead: 'false' } });
    expect(unreadOnly.data!.items).toHaveLength(0);
  });

  it("a member cannot read or mutate another user's notification", async () => {
    const { owner, columnId } = await setup();
    const member = await addMember(owner);
    await createIssue(owner.api, columnId, { assigneeUserId: member.userId });
    const inbox = await member.api.notifications.get({ query: {} });
    const id = inbox.data!.items[0].id;

    // The owner does not own this notification: mutating it is a 404.
    const res = await owner.api.notifications({ id }).read.post({ read: true } as never);
    expect(res.status).toBe(404);
  });
});
