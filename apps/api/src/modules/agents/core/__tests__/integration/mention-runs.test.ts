import { describe, it, expect, beforeEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { createComment } from '#modules/issues/activity';
import { claimDueRuns } from '../../run-queue';

// Mentioning an agent in a comment queues an agent_run so the agent can reply. The
// queue is drained by the in-process poller for an internal agent (not exercised
// here — it makes a live LLM call) and over HTTP by a runner for an external one.
// This test covers the deterministic half: a mention enqueues a run, a plain comment
// does not, an owner-scoped external agent ignores other members, and a comment
// authored by an agent's bot user never enqueues one (the loop guard). agent_run is
// read through the db; the loop guard is exercised at the store (an agent posts via
// the in-process add_comment tool, not the HTTP route, since it is not a project
// member).

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = view.data!.columns[0].id;
  return { owner, asOwner, columnId };
}

const agents = (api: Api) => api.projects({ projectKey: 'MKT' })['ai-agents'];

function createIssue(client: Api, columnId: number) {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' });
}

async function createInternalAgent(asOwner: Api, name: string, username: string) {
  const res = await agents(asOwner).post({ name, username, kind: 'internal' });
  return res.data!.agent;
}

// A mention as stored in a comment body: the handle of who it addresses.
const mention = (username: string) => `@${username}`;

async function runsForIssue(issueId: number) {
  return db.select().from(agentRun).where(eq(agentRun.issueId, issueId));
}

describe('agent mention runs', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('queues a run when a member mentions an internal agent', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;

    const res = await asOwner
      .issues({ issueId: issue.id })
      .comments.post({ body: `please review ${mention(agent.username)}` });
    expect(res.status).toBe(201);

    const queued = await runsForIssue(issue.id);
    expect(queued.length).toBe(1);
    expect(queued[0]).toMatchObject({ agentId: agent.id, issueId: issue.id, status: 'pending' });
    expect(queued[0].prompt).toContain('please review');
  });

  it("makes the queued run claimable with the agent's project and bot user", async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;
    await asOwner.issues({ issueId: issue.id }).comments.post({ body: mention(agent.username) });

    const claimed = await claimDueRuns();
    const run = claimed.find((r) => r.issueId === issue.id);
    expect(run).toBeDefined();
    expect(run).toMatchObject({ agentId: agent.id, agentUserId: agent.userId });
    expect(typeof run!.projectId).toBe('number');
  });

  it('gives a claimed run the thread the mention replies to, oldest first', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;
    const client = asOwner.issues({ issueId: issue.id });
    const first = (await client.comments.post({ body: 'the button is misaligned' })).data!;
    const second = (await client.comments.post({ body: 'only on mobile', replyToId: first.id }))
      .data!;
    await client.comments.post({
      body: `${mention(agent.username)} can you look?`,
      replyToId: second.id,
    });

    const claimed = await claimDueRuns();
    const run = claimed.find((r) => r.issueId === issue.id)!;
    expect(run.threadContext).toContain('Owner: the button is misaligned');
    expect(run.threadContext).toContain('Owner: only on mobile');
    expect(run.threadContext!.indexOf('misaligned')).toBeLessThan(
      run.threadContext!.indexOf('only on mobile'),
    );
    // The comment that mentioned the agent is the prompt, not part of the context.
    expect(run.threadContext).not.toContain('can you look?');
  });

  it('stops the thread context five comments above the mention', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;
    const client = asOwner.issues({ issueId: issue.id });
    let parentId = (await client.comments.post({ body: 'note 0' })).data!.id;
    for (let i = 1; i <= 6; i++) {
      parentId = (await client.comments.post({ body: `note ${i}`, replyToId: parentId })).data!.id;
    }
    await client.comments.post({
      body: mention(agent.username),
      replyToId: parentId,
    });

    const claimed = await claimDueRuns();
    const run = claimed.find((r) => r.issueId === issue.id)!;
    expect(run.threadContext).toContain('note 6');
    expect(run.threadContext).toContain('note 2');
    expect(run.threadContext).not.toContain('note 1');
    expect(run.threadContext).not.toContain('note 0');
  });

  it('leaves the thread context empty for a top-level mention', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;
    await asOwner.issues({ issueId: issue.id }).comments.post({ body: mention(agent.username) });

    const claimed = await claimDueRuns();
    expect(claimed.find((r) => r.issueId === issue.id)!.threadContext).toBeNull();
  });

  it("queues a run when someone answers the agent's own comment without tagging it", async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;
    const written = await createComment({
      issueId: issue.id,
      actorUserId: agent.userId,
      body: 'here is what I found',
    });

    await asOwner
      .issues({ issueId: issue.id })
      .comments.post({ body: 'and what about mobile?', replyToId: written.id });

    const queued = await runsForIssue(issue.id);
    expect(queued.length).toBe(1);
    expect(queued[0]).toMatchObject({ agentId: agent.id, trigger: 'mention' });
  });

  it('does not queue a run for a reply to a comment nobody but people wrote', async () => {
    const { asOwner, columnId } = await setup();
    await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;
    const client = asOwner.issues({ issueId: issue.id });
    const first = (await client.comments.post({ body: 'the button is misaligned' })).data!;

    await client.comments.post({ body: 'on mobile only', replyToId: first.id });
    expect((await runsForIssue(issue.id)).length).toBe(0);
  });

  it("does not queue a run when an agent answers another agent's comment (loop guard)", async () => {
    const { asOwner, columnId } = await setup();
    const author = await createInternalAgent(asOwner, 'Author Bot', 'author');
    const answering = await createInternalAgent(asOwner, 'Answer Bot', 'answer');
    const issue = (await createIssue(asOwner, columnId)).data!;
    const written = await createComment({
      issueId: issue.id,
      actorUserId: author.userId,
      body: 'done',
    });

    await createComment({
      issueId: issue.id,
      actorUserId: answering.userId,
      body: 'thanks',
      replyToId: written.id,
    });
    expect((await runsForIssue(issue.id)).length).toBe(0);
  });

  it('does not queue a run for a comment with no mention', async () => {
    const { asOwner, columnId } = await setup();
    await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'just a plain note' });
    expect((await runsForIssue(issue.id)).length).toBe(0);
  });

  it('queues a run for an external agent mentioned by its owner', async () => {
    const { asOwner, columnId } = await setup();
    const ext = (
      await agents(asOwner).post({
        name: 'Ext Bot',
        username: 'ext',
        kind: 'external',
        triggerOnMention: true,
      })
    ).data!.agent;
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner.issues({ issueId: issue.id }).comments.post({ body: mention(ext.username) });

    const queued = await runsForIssue(issue.id);
    expect(queued.length).toBe(1);
    expect(queued[0]).toMatchObject({ agentId: ext.id, status: 'pending' });
  });

  it('leaves an external agent alone until its mention trigger is turned on', async () => {
    const { asOwner, columnId } = await setup();
    const ext = (await agents(asOwner).post({ name: 'Ext Bot', username: 'ext', kind: 'external' }))
      .data!.agent;
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner.issues({ issueId: issue.id }).comments.post({ body: mention(ext.username) });
    expect((await runsForIssue(issue.id)).length).toBe(0);
  });

  it('does not queue an owner-scoped external agent for another member', async () => {
    const { asOwner, columnId } = await setup();
    const ext = (
      await agents(asOwner).post({
        name: 'Ext Bot',
        username: 'ext',
        kind: 'external',
        triggerOnMention: true,
        runnerScope: 'owner',
      })
    ).data!.agent;
    const asMember = await addProjectMember(asOwner, 'MKT');
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asMember.issues({ issueId: issue.id }).comments.post({ body: mention(ext.username) });
    expect((await runsForIssue(issue.id)).length).toBe(0);

    await agents(asOwner)({ agentId: ext.id }).patch({ runnerScope: 'project' });
    await asMember.issues({ issueId: issue.id }).comments.post({ body: mention(ext.username) });
    expect((await runsForIssue(issue.id)).length).toBe(1);
  });

  it('queues no run when an agent is mentioned in the description', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;

    // The description states the work; an agent is given an issue by delegating it.
    await asOwner
      .issues({ issueId: issue.id })
      .patch({ description: `${mention(agent.username)} please size this` });

    expect((await runsForIssue(issue.id)).length).toBe(0);
  });

  // Nothing reaches the agent from a description: no run, and no notification either,
  // which is what subscribes it to the issue.
  it('does not subscribe an agent mentioned in the description', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner
      .issues({ issueId: issue.id })
      .patch({ description: `${mention(agent.username)} please size this` });

    const watchers = (await asOwner.issues({ issueId: issue.id }).get()).data!.watchers;
    expect(watchers.some((w) => w.userId === agent.userId)).toBe(false);
  });

  it('queues no run when an agent is mentioned in a markdown custom field', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const field = (
      await asOwner
        .projects({ projectKey: 'MKT' })
        ['custom-fields'].post({ name: 'Notes', fieldType: 'markdown' })
    ).data!;
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner
      .issues({ issueId: issue.id })
      .fields({ fieldId: field.id })
      .put({ value: `${mention(agent.username)} take the copy` });

    expect((await runsForIssue(issue.id)).length).toBe(0);
  });

  it("does not queue a run when an agent's bot user authors the mention (loop guard)", async () => {
    const { asOwner, columnId } = await setup();
    const author = await createInternalAgent(asOwner, 'Author Bot', 'author');
    const target = await createInternalAgent(asOwner, 'Target Bot', 'target');
    const issue = (await createIssue(asOwner, columnId)).data!;

    // An agent comments via the in-process add_comment tool, i.e. createComment with
    // its own bot user as the author. Even though it mentions another internal agent,
    // no run is queued — this is what stops agent-to-agent mention loops.
    await createComment({
      issueId: issue.id,
      actorUserId: author.userId,
      body: `over to you ${mention(target.username)}`,
    });
    expect((await runsForIssue(issue.id)).length).toBe(0);
  });
});
