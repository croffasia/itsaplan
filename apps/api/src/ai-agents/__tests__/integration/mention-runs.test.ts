import { describe, it, expect, beforeEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';
import { createComment } from '../../../issues/activity';
import { claimDueRuns } from '../../run-queue';

// Mentioning an internal agent in a comment queues an agent_run so the agent can
// reply. The queue is drained by an in-process poller (not exercised here — it makes
// a live LLM call); this test covers the deterministic half: a mention enqueues a
// run, a plain comment does not, and a comment authored by an agent's bot user never
// enqueues one (the loop guard). agent_run has no API surface, so it is read through
// the db; the loop guard is exercised at the store (an agent posts via the in-process
// add_comment tool, not the HTTP route, since it is not a project member).

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

// The mention token as stored in a comment body.
const mention = (name: string, userId: string) => `@[${name}](user:${userId})`;

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
      .comments.post({ body: `please review ${mention('Design Bot', agent.userId)}` });
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
    await asOwner
      .issues({ issueId: issue.id })
      .comments.post({ body: mention('Design Bot', agent.userId) });

    const claimed = await claimDueRuns();
    const run = claimed.find((r) => r.issueId === issue.id);
    expect(run).toBeDefined();
    expect(run).toMatchObject({ agentId: agent.id, agentUserId: agent.userId });
    expect(typeof run!.projectId).toBe('number');
  });

  it('does not queue a run for a comment with no mention', async () => {
    const { asOwner, columnId } = await setup();
    await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'just a plain note' });
    expect((await runsForIssue(issue.id)).length).toBe(0);
  });

  it('does not queue a run for an external agent mentioned in a comment', async () => {
    const { asOwner, columnId } = await setup();
    const ext = (await agents(asOwner).post({ name: 'Ext Bot', username: 'ext', kind: 'external' }))
      .data!.agent;
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner
      .issues({ issueId: issue.id })
      .comments.post({ body: mention('Ext Bot', ext.userId) });
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
      body: `over to you ${mention('Target Bot', target.userId)}`,
    });
    expect((await runsForIssue(issue.id)).length).toBe(0);
  });
});
