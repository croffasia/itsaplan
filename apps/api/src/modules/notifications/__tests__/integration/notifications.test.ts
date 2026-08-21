import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// Notifications are fanned out when an issue changes and read back through the
// session user's inbox. The actor is never notified about their own action, and
// only project members receive notifications. New members join through invites, so
// a second member is added by creating and accepting an invite.

interface Member {
  api: Api;
  userId: string;
  username: string;
}

async function setup(): Promise<{ owner: Member; columnId: number; doneColumnId: number }> {
  const u = await signUpTestUser();
  const api = authedApi(u.cookie);
  await api.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await api.projects({ projectKey: 'MKT' }).get();
  const columns = view.data!.columns;
  const done = columns.find((c) => c.stateType === 'completed') ?? columns[columns.length - 1];
  return {
    owner: { api, userId: u.userId, username: u.username },
    columnId: columns[0].id,
    doneColumnId: done.id,
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

describe('notifications', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('notifies a member mentioned in the description', async () => {
    const { owner, columnId } = await setup();
    const member = await addMember(owner);
    const issue = (await createIssue(owner.api, columnId)).data!;

    await owner.api.issues({ issueId: issue.id }).patch({
      description: `@${member.username} please size this`,
    });

    const inbox = await member.api.notifications.get({ query: { types: 'mentioned' } });
    expect(inbox.data!.items).toHaveLength(1);
    expect(inbox.data!.items[0]).toMatchObject({ type: 'mentioned', actorUserId: owner.userId });
  });

  it('notifies a member mentioned in a markdown custom field', async () => {
    const { owner, columnId } = await setup();
    const member = await addMember(owner);
    const field = (
      await owner.api
        .projects({ projectKey: 'MKT' })
        ['custom-fields'].post({ name: 'Notes', fieldType: 'markdown' })
    ).data!;
    const issue = (await createIssue(owner.api, columnId)).data!;

    await owner.api
      .issues({ issueId: issue.id })
      .fields({ fieldId: field.id })
      .put({ value: `@${member.username} take the copy` });

    const inbox = await member.api.notifications.get({ query: { types: 'mentioned' } });
    expect(inbox.data!.items).toHaveLength(1);
  });

  it('does not notify again for a mention the description already carried', async () => {
    const { owner, columnId } = await setup();
    const member = await addMember(owner);
    const issue = (await createIssue(owner.api, columnId)).data!;
    const client = owner.api.issues({ issueId: issue.id });
    await client.patch({ description: `@${member.username} please size this` });

    await client.patch({ description: `@${member.username} please size this today` });

    const inbox = await member.api.notifications.get({ query: { types: 'mentioned' } });
    expect(inbox.data!.items).toHaveLength(1);
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

  it('notifies the member put into a member custom field', async () => {
    const { owner, columnId } = await setup();
    const member = await addMember(owner);
    const field = (
      await owner.api
        .projects({ projectKey: 'MKT' })
        ['custom-fields'].post({ name: 'Reviewer', fieldType: 'member', memberScope: 'humans' })
    ).data!;
    const issue = (await createIssue(owner.api, columnId, { title: 'Ship it' })).data!;

    await owner.api
      .issues({ issueId: issue.id })
      .fields({ fieldId: field.id })
      .put({ value: member.userId });

    const inbox = await member.api.notifications.get({ query: {} });
    expect(inbox.data!.items).toHaveLength(1);
    expect(inbox.data!.items[0]).toMatchObject({
      type: 'assigned',
      actorUserId: owner.userId,
      issueTitle: 'Ship it',
    });
  });

  it('notifies watchers on a comment', async () => {
    const { owner, columnId } = await setup();
    const member = await addMember(owner);

    // Owner creates the issue assigned to member, which subscribes both: the owner
    // as its author, the member through the assignment.
    const issue = await createIssue(owner.api, columnId, { assigneeUserId: member.userId });
    const issueId = issue.data!.id;

    // Member comments -> owner (a watcher) gets a 'commented' notification.
    await owner.api.issues({ issueId }).comments.post({ body: 'looking into it' } as never);
    await member.api.issues({ issueId }).comments.post({ body: 'done' } as never);

    const ownerInbox = await owner.api.notifications.get({ query: { types: 'commented' } });
    expect(ownerInbox.data!.items).toHaveLength(1);
    expect(ownerInbox.data!.items[0]).toMatchObject({
      type: 'commented',
      actorUserId: member.userId,
    });
  });

  it('a status change notification names the states it moved between', async () => {
    const { owner, columnId, doneColumnId } = await setup();
    const member = await addMember(owner);
    const issue = await createIssue(owner.api, columnId, { assigneeUserId: member.userId });

    await owner.api.issues({ issueId: issue.data!.id }).patch({ columnId: doneColumnId });

    const view = await owner.api.projects({ projectKey: 'MKT' }).get();
    const names = new Map(view.data!.columns.map((c) => [c.id, c.name]));
    const inbox = await member.api.notifications.get({ query: { types: 'state_changed' } });
    expect(inbox.data!.items).toHaveLength(1);
    expect(inbox.data!.items[0]).toMatchObject({
      type: 'state_changed',
      fromState: names.get(columnId),
      toState: names.get(doneColumnId),
    });
  });

  it('unread count tracks reads', async () => {
    const { owner, columnId } = await setup();
    const member = await addMember(owner);
    await createIssue(owner.api, columnId, { assigneeUserId: member.userId });

    const first = await member.api.notifications.unread.get({ query: {} });
    expect(first.data!.unread).toBe(1);

    const inbox = await member.api.notifications.get({ query: {} });
    const id = inbox.data!.items[0].id;
    const read = await member.api.notifications({ id }).read.post({ read: true } as never);
    expect(read.status).toBe(204);

    expect((await member.api.notifications.unread.get({ query: {} })).data!.unread).toBe(0);

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
