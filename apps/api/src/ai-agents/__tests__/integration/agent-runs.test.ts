import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';

// The run-history endpoint: GET /projects/:key/ai-agents/:agentId/runs lists an agent's
// triggered runs (a mention or a delegation), newest first, keyset-paginated. Runs are
// created by the same paths the runtime uses: mentioning the agent in a comment queues
// a mention run; delegating an issue to an agent with trigger_on_assign queues a
// delegation run. The poller (a live LLM call) is not exercised, so runs stay pending.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = view.data!.columns[0].id;
  return { owner, asOwner, columnId };
}

const agents = (api: Api) => api.projects({ projectKey: 'MKT' })['ai-agents'];

function createIssue(client: Api, columnId: number, title = 'Task') {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
}

async function createInternalAgent(asOwner: Api, name: string, username: string) {
  const res = await agents(asOwner).post({ name, username, kind: 'internal' });
  return res.data!.agent;
}

const mention = (name: string, userId: string) => `@[${name}](user:${userId})`;

// Queues a mention run by commenting on the issue with the agent tagged.
async function mentionAgent(asOwner: Api, issueId: number, agentName: string, agentUserId: string) {
  await asOwner
    .issues({ issueId })
    .comments.post({ body: `please review ${mention(agentName, agentUserId)}` });
}

describe('agent run history', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns an empty page for an agent with no runs', async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');

    const res = await agents(asOwner)({ agentId: agent.id }).runs.get();
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ items: [], nextCursor: null });
  });

  it('lists a mention run with the issue, trigger, and rendered prompt', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId, 'Landing page')).data!;
    await mentionAgent(asOwner, issue.id, 'Design Bot', agent.userId);

    const res = await agents(asOwner)({ agentId: agent.id }).runs.get();
    expect(res.status).toBe(200);
    expect(res.data!.items.length).toBe(1);
    const run = res.data!.items[0];
    expect(run).toMatchObject({
      status: 'pending',
      trigger: 'mention',
      issueId: issue.id,
      issueIdentifier: issue.identifier,
      issueTitle: 'Landing page',
    });
    // The stored mention token is rendered to @Name for display (no id leaks through).
    expect(run.prompt).toContain('@Design Bot');
    expect(run.prompt).not.toContain('user:');
  });

  it('lists a delegation run when an issue is delegated to the agent', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await agents(asOwner)({ agentId: agent.id }).patch({ triggerOnAssign: true });
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner.issues({ issueId: issue.id }).patch({ delegateUserId: agent.userId });

    const res = await agents(asOwner)({ agentId: agent.id }).runs.get();
    expect(res.status).toBe(200);
    expect(res.data!.items.length).toBe(1);
    expect(res.data!.items[0]).toMatchObject({ trigger: 'delegation', issueId: issue.id });
  });

  it('paginates newest first with a keyset cursor', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;
    await mentionAgent(asOwner, issue.id, 'Design Bot', agent.userId);
    await mentionAgent(asOwner, issue.id, 'Design Bot', agent.userId);
    await mentionAgent(asOwner, issue.id, 'Design Bot', agent.userId);

    const first = await agents(asOwner)({ agentId: agent.id }).runs.get({ query: { limit: 2 } });
    expect(first.data!.items.length).toBe(2);
    expect(first.data!.nextCursor).not.toBeNull();
    // Newest first: ids strictly decreasing.
    expect(first.data!.items[0].id).toBeGreaterThan(first.data!.items[1].id);

    const second = await agents(asOwner)({ agentId: agent.id }).runs.get({
      query: { before: first.data!.nextCursor!, limit: 2 },
    });
    expect(second.data!.items.length).toBe(1);
    expect(second.data!.nextCursor).toBeNull();
    expect(second.data!.items[0].id).toBeLessThan(first.data!.items[1].id);
  });

  it('scopes runs to the requested agent', async () => {
    const { asOwner, columnId } = await setup();
    const a = await createInternalAgent(asOwner, 'Bot A', 'bota');
    const b = await createInternalAgent(asOwner, 'Bot B', 'botb');
    const issue = (await createIssue(asOwner, columnId)).data!;
    await mentionAgent(asOwner, issue.id, 'Bot A', a.userId);

    const runsB = await agents(asOwner)({ agentId: b.id }).runs.get();
    expect(runsB.data!.items.length).toBe(0);
    const runsA = await agents(asOwner)({ agentId: a.id }).runs.get();
    expect(runsA.data!.items.length).toBe(1);
  });

  it('404s for an agent that does not exist in the project', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner)({ agentId: 999999 }).runs.get();
    expect(res.status).toBe(404);
  });

  it('400s for a non-numeric agent id', async () => {
    const { asOwner } = await setup();
    const res = await agents(asOwner)({ agentId: 'abc' }).runs.get();
    expect(res.status).toBe(400);
  });

  it('denies a non-member with 403', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;
    await mentionAgent(asOwner, issue.id, 'Design Bot', agent.userId);

    const outsider = await signUpTestUser({ name: 'Outsider' });
    const res = await agents(authedApi(outsider.cookie))({ agentId: agent.id }).runs.get();
    expect(res.status).toBe(403);
  });
});
