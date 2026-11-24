import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';

// The Docs home lists the open threads that wait for the caller: the last message is
// someone else's, and the thread mentions the caller or the caller wrote in it.

interface Member {
  api: Api;
  userId: string;
  username: string;
}

const paragraph = (value: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
});

async function setup() {
  const u = await signUpTestUser({ name: 'Owner' });
  const owner: Member = { api: authedApi(u.cookie), userId: u.userId, username: u.username };
  await createProject(owner.api, { key: 'DOC', name: 'Documents' });
  const m = await signUpTestUser({ name: 'Maya' });
  const invite = await owner.api
    .projects({ projectKey: 'DOC' })
    .invites.post({ email: m.email, role: 'member' });
  const member: Member = { api: authedApi(m.cookie), userId: m.userId, username: m.username };
  await member.api.invites({ token: invite.data!.token }).accept.post();
  return { owner, member };
}

// A page by `author` holding "Hello world", and a thread on "Hello" with the first message.
async function thread(author: Member, body: string, title = 'Plan') {
  const documents = author.api.projects({ projectKey: 'DOC' }).documents;
  const created = (
    await documents.post({
      title,
      icon: '📘',
      content: 'Hello world',
      contentJson: paragraph('Hello world'),
    })
  ).data!;
  const root = (
    await documents({ documentId: created.id }).comments.post({
      body,
      quote: 'Hello',
      from: 1,
      to: 6,
      version: created.version,
    })
  ).data!;
  return { documentId: created.id, threadId: root.id };
}

const reply = (member: Member, documentId: number, threadId: string, body: string) =>
  member.api
    .projects({ projectKey: 'DOC' })
    .documents({ documentId })
    .comments.post({ parentId: threadId, body });

const forYou = async (member: Member) => {
  const response = await member.api.projects({ projectKey: 'DOC' }).documents['for-you'].get();
  expect(response.status).toBe(200);
  return response.data!;
};

describe('GET /projects/:projectKey/documents/for-you', () => {
  beforeEach(resetDb);

  it('lists a thread whose last message mentions the caller', async () => {
    const { owner, member } = await setup();
    const { documentId, threadId } = await thread(owner, `@${member.username} can you check?`);

    expect(await forYou(member)).toEqual([
      {
        threadId,
        documentId,
        documentTitle: 'Plan',
        documentIcon: '📘',
        authorId: owner.userId,
        authorName: 'Owner',
        authorImage: null,
        body: `@${member.username} can you check?`,
        kind: 'mention',
        createdAt: expect.any(Date),
      },
    ]);
    expect(await forYou(owner)).toEqual([]);
  });

  it('lists a reply in a thread the caller wrote in, until the caller answers', async () => {
    const { owner, member } = await setup();
    const { documentId, threadId } = await thread(member, 'Is this right?');
    expect(await forYou(member)).toEqual([]);

    await reply(owner, documentId, threadId, 'Yes, it is.');
    expect(await forYou(member)).toMatchObject([
      { threadId, authorId: owner.userId, body: 'Yes, it is.', kind: 'reply' },
    ]);

    await reply(member, documentId, threadId, 'Thanks.');
    expect(await forYou(member)).toEqual([]);
  });

  it('leaves out threads that do not involve the caller', async () => {
    const { owner, member } = await setup();
    await thread(owner, 'A note for nobody');
    await thread(owner, `\`@${member.username}\` is code, not a mention`);
    await thread(owner, `@${member.username}x is someone else`);

    expect(await forYou(member)).toEqual([]);
  });

  it('leaves out resolved threads', async () => {
    const { owner, member } = await setup();
    const { documentId, threadId } = await thread(owner, `@${member.username} look`);
    await owner.api
      .projects({ projectKey: 'DOC' })
      .documents({ documentId })
      .comments({ commentId: threadId })
      .patch({ resolved: true });

    expect(await forYou(member)).toEqual([]);
  });

  it('leaves out pages the caller cannot open and archived pages', async () => {
    const { owner, member } = await setup();
    const documents = owner.api.projects({ projectKey: 'DOC' }).documents;
    const hidden = await thread(owner, `@${member.username} private`, 'Hidden');
    const shared = await thread(owner, `@${member.username} shared`, 'Shared');
    const archived = await thread(owner, `@${member.username} archived`, 'Archived');
    const version = async (documentId: number) =>
      (await documents({ documentId }).get()).data!.version;
    await documents({ documentId: hidden.documentId }).access.post({
      version: await version(hidden.documentId),
      isPrivate: true,
      memberIds: [],
    });
    await documents({ documentId: shared.documentId }).access.post({
      version: await version(shared.documentId),
      isPrivate: true,
      memberIds: [member.userId],
    });
    await documents({ documentId: archived.documentId }).archive.post({
      version: await version(archived.documentId),
    });

    expect((await forYou(member)).map((item) => item.documentTitle)).toEqual(['Shared']);
  });

  it('lists the newest thread first', async () => {
    const { owner, member } = await setup();
    const first = await thread(owner, `@${member.username} first`, 'First');
    const second = await thread(owner, `@${member.username} second`, 'Second');
    expect((await forYou(member)).map((item) => item.threadId)).toEqual([
      second.threadId,
      first.threadId,
    ]);

    await reply(owner, first.documentId, first.threadId, 'Bumped');
    expect((await forYou(member)).map((item) => item.threadId)).toEqual([
      first.threadId,
      second.threadId,
    ]);
  });

  it('refuses a user outside the project', async () => {
    await setup();
    const outsider = await signUpTestUser({ name: 'Outsider' });
    const response = await authedApi(outsider.cookie)
      .projects({ projectKey: 'DOC' })
      .documents['for-you'].get();
    expect(response.status).toBe(403);
  });
});
