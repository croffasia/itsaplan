import { beforeEach, describe, expect, it } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, projectIdOf, setAgentProjectRole, teamOf } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { claimDueRuns } from '#modules/agents/core/run-queue';
import { addDocumentComment } from '../../comments';

// A document's text notifies the members it names and runs no agent. A comment on it
// notifies the members it names and queues a run for the agents it names, which the
// claim hands the document and the thread. agent_run is read through the db, as the
// issue mention tests do: a queued run has no route of its own.

interface Member {
  api: Api;
  userId: string;
  username: string;
}

const paragraph = (...content: Record<string, unknown>[]) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content }],
});
const text = (value: string) => ({ type: 'text', text: value });
const mention = (username: string) => ({ type: 'mention', attrs: { username } });

async function setup() {
  const u = await signUpTestUser({ name: 'Owner' });
  const owner: Member = { api: authedApi(u.cookie), userId: u.userId, username: u.username };
  await createProject(owner.api, { key: 'DOC', name: 'Documents' });
  return { owner, documents: owner.api.projects({ projectKey: 'DOC' }).documents };
}

async function addMember(owner: Member, roleId?: number): Promise<Member> {
  const u = await signUpTestUser({ name: 'Member' });
  const invite = await owner.api
    .projects({ projectKey: 'DOC' })
    .invites.post({ email: u.email, role: 'member', roleId });
  const api = authedApi(u.cookie);
  await api.invites({ token: invite.data!.token }).accept.post();
  return { api, userId: u.userId, username: u.username };
}

async function createInternalAgent(owner: Member) {
  return (
    await createAgent(owner.api, 'DOC', { name: 'Doc Bot', username: 'docbot', kind: 'internal' })
  ).data!.agent;
}

// A shared document holding "Hello world", and the first thread on "Hello".
async function documentWithThread(owner: Member) {
  const documents = owner.api.projects({ projectKey: 'DOC' }).documents;
  const created = (
    await documents.post({
      title: 'Plan',
      content: 'Hello world',
      contentJson: paragraph(text('Hello world')),
    })
  ).data!;
  const doc = documents({ documentId: created.id });
  const root = (
    await doc.comments.post({
      body: 'Is this right?',
      quote: 'Hello',
      from: 1,
      to: 6,
      version: created.version,
    })
  ).data!;
  return { id: created.id, doc, rootId: root.id };
}

const mentions = async (member: Member) =>
  (await member.api.notifications.get({ query: { types: 'mentioned' } })).data!.items;

const runsFor = (documentId: number) =>
  db.select().from(agentRun).where(eq(agentRun.documentId, documentId));

describe('document mentions', () => {
  beforeEach(resetDb);

  it('notifies a member mentioned in a comment, pointing at the document and the comment', async () => {
    const { owner } = await setup();
    const member = await addMember(owner);
    const { id, doc, rootId } = await documentWithThread(owner);

    const reply = await doc.comments.post({
      parentId: rootId,
      body: `@${member.username} please check`,
    });
    expect(reply.status).toBe(201);

    const items = await mentions(member);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'mentioned',
      actorUserId: owner.userId,
      issueId: null,
      documentId: id,
      documentTitle: 'Plan',
      documentCommentId: reply.data!.id,
      projectKey: 'DOC',
    });
    expect(await mentions(owner)).toHaveLength(0);
  });

  it('notifies only the handles an edit of a comment adds', async () => {
    const { owner } = await setup();
    const first = await addMember(owner);
    const second = await addMember(owner);
    const { doc, rootId } = await documentWithThread(owner);
    const reply = (await doc.comments.post({ parentId: rootId, body: `@${first.username} look` }))
      .data!;

    const edited = await doc.comments({ commentId: reply.id }).patch({
      body: `@${first.username} @${second.username} look`,
    });
    expect(edited.status).toBe(200);

    expect(await mentions(first)).toHaveLength(1);
    expect(await mentions(second)).toHaveLength(1);
  });

  it('does not notify a member whose role cannot read documents', async () => {
    const { owner } = await setup();
    const role = await createRole(owner.api, 'DOC', {
      name: 'Board only',
      permissions: { work_items: { read: true } },
    });
    const member = await addMember(owner, role.data!.id);
    const { doc, rootId } = await documentWithThread(owner);

    await doc.comments.post({ parentId: rootId, body: `@${member.username} see this` });

    expect(await mentions(member)).toHaveLength(0);
  });

  it('queues a run for a mentioned agent, claimed with the document and the thread', async () => {
    const { owner } = await setup();
    const agent = await createInternalAgent(owner);
    const { id, doc, rootId } = await documentWithThread(owner);
    for (let i = 1; i <= 6; i++) await doc.comments.post({ parentId: rootId, body: `note ${i}` });

    const asked = (
      await doc.comments.post({ parentId: rootId, body: `@${agent.username} summarize` })
    ).data!;

    const queued = await runsFor(id);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      agentId: agent.id,
      issueId: null,
      sourceDocumentCommentId: asked.id,
      trigger: 'mention',
      status: 'pending',
    });

    const run = (await claimDueRuns()).find((claimed) => claimed.documentId === id)!;
    expect(run).toMatchObject({
      documentTitle: 'Plan',
      documentQuote: 'Hello',
      threadRootId: rootId,
      requesterName: 'Owner',
      requesterUsername: owner.username,
      requesterUserId: owner.userId,
    });
    expect(run.threadContext).toContain('Owner: note 6');
    expect(run.threadContext).toContain('Owner: note 2');
    expect(run.threadContext).not.toContain('note 1');
    expect(run.threadContext).not.toContain('summarize');
  });

  it("names the document in the agent's run history, without the title once it is private", async () => {
    const { owner } = await setup();
    const agent = await createInternalAgent(owner);
    const { id, doc, rootId } = await documentWithThread(owner);
    await doc.comments.post({ parentId: rootId, body: `@${agent.username} summarize` });
    const teamId = await teamOf(owner.api, 'DOC');
    const history = () =>
      owner.api.teams({ teamId })['ai-agents']({ agentId: agent.id }).runs.get();

    const listed = await history();
    expect(listed.status).toBe(200);
    expect(listed.data!.items[0]).toMatchObject({
      issueId: null,
      documentId: id,
      documentTitle: 'Plan',
    });

    const { version } = (await doc.get()).data!;
    expect((await doc.access.post({ version, isPrivate: true })).status).toBe(200);
    expect((await history()).data!.items[0]).toMatchObject({ documentId: id, documentTitle: null });
  });

  it('starts no run for an agent whose role cannot comment on documents', async () => {
    const { owner } = await setup();
    const agent = await createInternalAgent(owner);
    const role = await createRole(owner.api, 'DOC', {
      name: 'Docs reader',
      permissions: { documents: { read: true } },
    });
    await setAgentProjectRole(owner.api, 'DOC', agent.userId, role.data!.id);
    const { id, doc, rootId } = await documentWithThread(owner);

    await doc.comments.post({ parentId: rootId, body: `@${agent.username} summarize` });

    expect(await runsFor(id)).toHaveLength(0);
  });

  it('queues a run for the agent a reply answers, without a tag', async () => {
    const { owner } = await setup();
    const agent = await createInternalAgent(owner);
    const { id, doc, rootId } = await documentWithThread(owner);
    const projectId = await projectIdOf(owner.api, 'DOC');
    await addDocumentComment(projectId, id, agent.userId, { parentId: rootId, body: 'Done.' });

    const answer = (await doc.comments.post({ parentId: rootId, body: 'Thanks, now the summary' }))
      .data!;
    const later = await doc.comments.post({ parentId: rootId, body: 'And one more note' });
    expect(later.status).toBe(201);

    const queued = await runsFor(id);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ agentId: agent.id, sourceDocumentCommentId: answer.id });
  });

  it('starts no run for a comment an agent wrote', async () => {
    const { owner } = await setup();
    const agent = await createInternalAgent(owner);
    const { id, rootId } = await documentWithThread(owner);
    const projectId = await projectIdOf(owner.api, 'DOC');

    await addDocumentComment(projectId, id, agent.userId, {
      parentId: rootId,
      body: `@${agent.username} again`,
    });

    expect(await runsFor(id)).toHaveLength(0);
  });

  it('notifies a member named in the text and runs no agent named there', async () => {
    const { owner, documents } = await setup();
    const member = await addMember(owner);
    const agent = await createInternalAgent(owner);

    const created = await documents.post({
      title: 'Spec',
      content: `Owned by @${member.username} and @${agent.username}`,
      contentJson: paragraph(
        text('Owned by '),
        mention(member.username),
        text(' and '),
        mention(agent.username),
      ),
    });
    expect(created.status).toBe(201);

    const items = await mentions(member);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ documentId: created.data!.id, documentCommentId: null });
    expect(await runsFor(created.data!.id)).toHaveLength(0);
  });

  it('reads the text mentions from the mention nodes, and notifies each one once', async () => {
    const { owner, documents } = await setup();
    const member = await addMember(owner);
    const created = (
      await documents.post({
        title: 'Spec',
        content: `typed @${member.username}`,
        contentJson: paragraph(text(`typed @${member.username}`)),
      })
    ).data!;
    expect(await mentions(member)).toHaveLength(0);

    const doc = documents({ documentId: created.id });
    const withMention = paragraph(text('picked '), mention(member.username));
    const updated = (
      await doc.patch({
        version: created.version,
        content: `picked @${member.username}`,
        contentJson: withMention,
      })
    ).data!;
    await doc.patch({
      version: updated.version,
      content: `picked @${member.username} again`,
      contentJson: paragraph(text('picked '), mention(member.username), text(' again')),
    });

    expect(await mentions(member)).toHaveLength(1);
  });

  it('reads a page written as markdown alone from the markdown', async () => {
    const { owner, documents } = await setup();
    const member = await addMember(owner);
    const created = (await documents.post({ title: 'Notes', content: 'Draft' })).data!;

    await documents({ documentId: created.id }).patch({
      version: created.version,
      content: `@${member.username} review`,
    });

    expect(await mentions(member)).toHaveLength(1);
  });

  it('reaches nobody from a private document', async () => {
    const { owner, documents } = await setup();
    const member = await addMember(owner);
    const agent = await createInternalAgent(owner);
    const created = (
      await documents.post({
        title: 'Mine',
        content: 'Hello world',
        contentJson: paragraph(text('Hello world')),
        isPrivate: true,
      })
    ).data!;
    const doc = documents({ documentId: created.id });

    await doc.comments.post({
      body: `@${member.username} @${agent.username}`,
      quote: 'Hello',
      from: 1,
      to: 6,
      version: created.version,
    });

    expect(await mentions(member)).toHaveLength(0);
    expect(await runsFor(created.id)).toHaveLength(0);
  });

  it('takes a reply without a version and refuses a new thread without one', async () => {
    const { owner } = await setup();
    const { doc, rootId } = await documentWithThread(owner);

    expect((await doc.comments.post({ parentId: rootId, body: 'Agreed' })).status).toBe(201);
    expect((await doc.comments.post({ body: 'New', quote: 'Hello', from: 1, to: 6 })).status).toBe(
      400,
    );
  });
});
