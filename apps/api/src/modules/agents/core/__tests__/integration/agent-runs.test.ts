import { describe, it, expect, beforeEach } from 'bun:test';
import { apiKeyApi, authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, projectIdOf, teamOf } from '#tests/helpers/agents';
import { createRole } from '#tests/helpers/roles';
import { addProjectMember } from '#tests/helpers/members';

// The run-history endpoint: GET /projects/:key/ai-agents/:agentId/runs lists an agent's
// triggered runs (a mention or a delegation), newest first, keyset-paginated. Runs are
// created by the same paths the runtime uses: mentioning the agent in a comment queues
// a mention run; delegating an issue to an agent with trigger_on_assign queues a
// delegation run; setting it into a member custom field it carries a trigger for
// queues a field run, held back by that trigger's own delay. The poller (a live LLM
// call) is not exercised, so runs stay pending. A delegation or field change made by
// an agent's bot user queues nothing (the loop guard): the agent acts over HTTP with
// its API key, which is the credential its runner and the MCP endpoint both carry.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = view.data!.columns[0].id;
  return { owner, asOwner, columnId, teamId: project.data!.teamId };
}

// The agent routes of the team the project belongs to, which is where agents live.
const agents = (api: Api, teamId: number) => api.teams({ teamId })['ai-agents'];

function createIssue(client: Api, columnId: number, title = 'Task') {
  return client.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
}

async function createInternalAgent(asOwner: Api, name: string, username: string) {
  const res = await createAgent(asOwner, 'MKT', { name, username, kind: 'internal' });
  return res.data!.agent;
}

// A member field that takes agents.
async function memberField(asOwner: Api, name: string) {
  const res = await asOwner
    .projects({ projectKey: 'MKT' })
    ['custom-fields'].post({ name, fieldType: 'member', memberScope: 'agents' });
  return res.data!;
}

// A member field the agent reacts to, with the delay its run waits.
async function fieldTrigger(
  asOwner: Api,
  teamId: number,
  agentId: number,
  name: string,
  delaySec: number,
) {
  const field = await memberField(asOwner, name);
  await agents(
    asOwner,
    teamId,
  )({ agentId }).patch({
    fieldTriggers: [{ fieldId: field.id, delaySec }],
  });
  return field;
}

// Queues a mention run by commenting on the issue with the agent tagged.
async function mentionAgent(asOwner: Api, issueId: number, username: string) {
  await asOwner.issues({ issueId }).comments.post({ body: `please review @${username}` });
}

describe('agent run history', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns an empty page for an agent with no runs', async () => {
    const { asOwner, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).runs.get();
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ items: [], nextCursor: null });
  });

  it('lists a mention run with the issue, trigger, and rendered prompt', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId, 'Landing page')).data!;
    await mentionAgent(asOwner, issue.id, agent.username);

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).runs.get();
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
    expect(run.prompt).toContain('@design');
  });

  it('lists a delegation run when an issue is delegated to the agent', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await agents(asOwner, teamId)({ agentId: agent.id }).patch({ triggerOnAssign: true });
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner.issues({ issueId: issue.id }).patch({ delegateUserId: agent.userId });

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).runs.get();
    expect(res.status).toBe(200);
    expect(res.data!.items.length).toBe(1);
    expect(res.data!.items[0]).toMatchObject({ trigger: 'delegation', issueId: issue.id });
  });

  it('queues a run when the agent is set into a field it reacts to', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const field = (
      await asOwner
        .projects({ projectKey: 'MKT' })
        ['custom-fields'].post({ name: 'Reviewer', fieldType: 'member', memberScope: 'agents' })
    ).data!;
    await agents(
      asOwner,
      teamId,
    )({ agentId: agent.id }).patch({
      fieldTriggers: [{ fieldId: field.id, delaySec: 0 }],
    });
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner
      .issues({ issueId: issue.id })
      .fields({ fieldId: field.id })
      .put({ value: agent.userId });

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).runs.get();
    expect(res.data!.items.length).toBe(1);
    expect(res.data!.items[0]).toMatchObject({ trigger: 'field', issueId: issue.id });
    expect(res.data!.items[0].prompt).toContain('Reviewer');
  });

  it('queues nothing when the agent carries no trigger for the field', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const field = (
      await asOwner
        .projects({ projectKey: 'MKT' })
        ['custom-fields'].post({ name: 'Reviewer', fieldType: 'member', memberScope: 'agents' })
    ).data!;
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner
      .issues({ issueId: issue.id })
      .fields({ fieldId: field.id })
      .put({ value: agent.userId });

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).runs.get();
    expect(res.data!.items).toEqual([]);
  });

  it('holds a delegation run back by the agent delay, and a mention run not at all', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await agents(asOwner, teamId)({ agentId: agent.id }).patch({ triggerOnAssign: true });
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner.issues({ issueId: issue.id }).patch({ delegateUserId: agent.userId });
    await mentionAgent(asOwner, issue.id, agent.username);

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).runs.get();
    const byTrigger = new Map(res.data!.items.map((r) => [r.trigger, r]));
    const dueInMs = (at: string) => new Date(at).getTime() - Date.now();
    // The default delay is two minutes; the assertion leaves room for the round trip.
    expect(dueInMs(byTrigger.get('delegation')!.nextAttemptAt)).toBeGreaterThan(110_000);
    expect(dueInMs(byTrigger.get('mention')!.nextAttemptAt)).toBeLessThanOrEqual(0);
  });

  it('starts a delegation run at once when the delay is zero', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await agents(
      asOwner,
      teamId,
    )({ agentId: agent.id }).patch({
      triggerOnAssign: true,
      delegationDelaySec: 0,
    });
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner.issues({ issueId: issue.id }).patch({ delegateUserId: agent.userId });

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).runs.get();
    const run = res.data!.items[0];
    expect(new Date(run.nextAttemptAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("holds a field run back by that field trigger's own delay", async () => {
    const { asOwner, columnId, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const now = await memberField(asOwner, 'Reviewer');
    const later = await memberField(asOwner, 'Owner');
    await agents(
      asOwner,
      teamId,
    )({ agentId: agent.id }).patch({
      fieldTriggers: [
        { fieldId: now.id, delaySec: 0 },
        { fieldId: later.id, delaySec: 600 },
      ],
    });
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner
      .issues({ issueId: issue.id })
      .fields({ fieldId: now.id })
      .put({ value: agent.userId });
    await asOwner
      .issues({ issueId: issue.id })
      .fields({ fieldId: later.id })
      .put({ value: agent.userId });

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).runs.get();
    const byField = res.data!.items.map((r) => ({
      prompt: r.prompt,
      dueInMs: new Date(r.nextAttemptAt).getTime() - Date.now(),
    }));
    const immediate = byField.find((r) => r.prompt.includes('Reviewer'))!;
    const delayed = byField.find((r) => r.prompt.includes('Owner'))!;
    expect(immediate.dueInMs).toBeLessThanOrEqual(0);
    expect(delayed.dueInMs).toBeGreaterThan(590_000);
  });

  it('queues nothing when the same member is set again', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const field = await fieldTrigger(asOwner, teamId, agent.id, 'Reviewer', 0);
    const issue = (await createIssue(asOwner, columnId)).data!;
    const value = asOwner.issues({ issueId: issue.id }).fields({ fieldId: field.id });

    await value.put({ value: agent.userId });
    await value.put({ value: agent.userId });

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).runs.get();
    expect(res.data!.items.length).toBe(1);
  });

  it('drops the trigger when the field stops taking agents', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const field = await fieldTrigger(asOwner, teamId, agent.id, 'Reviewer', 0);
    await asOwner
      .projects({ projectKey: 'MKT' })
      ['custom-fields']({ fieldId: field.id })
      .patch({ memberScope: 'humans' });
    await asOwner
      .projects({ projectKey: 'MKT' })
      ['custom-fields']({ fieldId: field.id })
      .patch({ memberScope: 'agents' });
    const issue = (await createIssue(asOwner, columnId)).data!;

    await asOwner
      .issues({ issueId: issue.id })
      .fields({ fieldId: field.id })
      .put({ value: agent.userId });

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).runs.get();
    expect(res.data!.items).toEqual([]);
  });

  it('paginates newest first with a keyset cursor', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;
    await mentionAgent(asOwner, issue.id, agent.username);
    await mentionAgent(asOwner, issue.id, agent.username);
    await mentionAgent(asOwner, issue.id, agent.username);

    const first = await agents(
      asOwner,
      teamId,
    )({ agentId: agent.id }).runs.get({ query: { limit: 2 } });
    expect(first.data!.items.length).toBe(2);
    expect(first.data!.nextCursor).not.toBeNull();
    // Newest first: ids strictly decreasing.
    expect(first.data!.items[0].id).toBeGreaterThan(first.data!.items[1].id);

    const second = await agents(
      asOwner,
      teamId,
    )({ agentId: agent.id }).runs.get({
      query: { before: first.data!.nextCursor!, limit: 2 },
    });
    expect(second.data!.items.length).toBe(1);
    expect(second.data!.nextCursor).toBeNull();
    expect(second.data!.items[0].id).toBeLessThan(first.data!.items[1].id);
  });

  it('scopes runs to the requested agent', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const a = await createInternalAgent(asOwner, 'Bot A', 'bota');
    const b = await createInternalAgent(asOwner, 'Bot B', 'botb');
    const issue = (await createIssue(asOwner, columnId)).data!;
    await mentionAgent(asOwner, issue.id, a.username);

    const runsB = await agents(asOwner, teamId)({ agentId: b.id }).runs.get();
    expect(runsB.data!.items.length).toBe(0);
    const runsA = await agents(asOwner, teamId)({ agentId: a.id }).runs.get();
    expect(runsA.data!.items.length).toBe(1);
  });

  it('404s for an agent that does not exist in the project', async () => {
    const { asOwner, teamId } = await setup();
    const res = await agents(asOwner, teamId)({ agentId: 999999 }).runs.get();
    expect(res.status).toBe(404);
  });

  it('400s for a non-numeric agent id', async () => {
    const { asOwner, teamId } = await setup();
    const res = await agents(asOwner, teamId)({ agentId: 'abc' }).runs.get();
    expect(res.status).toBe(400);
  });

  // A run carries the prompt it was given and what it answered, so the history is
  // bounded to the projects the reader belongs to. Seeing the agent — which one shared
  // project is enough for — is not seeing what it did in the rest of the team.
  it('hides the runs of a project the reader is not a member of', async () => {
    const { asOwner, columnId, teamId } = await setup();
    const ops = await asOwner.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
    const opsColumn = (await asOwner.projects({ projectKey: 'OPS' }).get()).data!.columns[0].id;
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    await agents(
      asOwner,
      teamId,
    )({ agentId: agent.id }).projects.put({
      projectIds: [await projectIdOf(asOwner, 'MKT'), ops.data!.id],
    });

    const mktIssue = (await createIssue(asOwner, columnId, 'Landing page')).data!;
    await mentionAgent(asOwner, mktIssue.id, agent.username);
    const opsIssue = (
      await asOwner
        .projects({ projectKey: 'OPS' })
        .issues.post({ columnId: opsColumn, title: 'Pager' })
    ).data!;
    await asOwner.issues({ issueId: opsIssue.id }).comments.post({
      body: `please review @${agent.username}`,
    });

    const role = await createRole(asOwner, 'MKT', {
      name: 'Agent handler',
      permissions: { ai_agents: { read: true } },
    });
    const asMember = await addProjectMember(asOwner, 'MKT', role.data!.id);

    // The owner runs the team, so both runs are theirs.
    const all = await agents(asOwner, teamId)({ agentId: agent.id }).runs.get();
    expect(all.data!.items.length).toBe(2);

    // The member is only in MKT, so the OPS run is not in their page at all.
    const mine = await agents(asMember, teamId)({ agentId: agent.id }).runs.get();
    expect(mine.status).toBe(200);
    expect(mine.data!.items.map((r) => r.issueIdentifier)).toEqual(['MKT-1']);
  });

  it('denies a non-member with 404', async () => {
    const { asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = (await createIssue(asOwner, columnId)).data!;
    await mentionAgent(asOwner, issue.id, agent.username);

    // A team the caller does not belong to reads as one that does not exist.
    const outsider = authedApi((await signUpTestUser({ name: 'Outsider' })).cookie);
    const res = await outsider
      .teams({ teamId: await teamOf(asOwner, 'MKT') })
      ['ai-agents']({ agentId: agent.id })
      .runs.get({ query: {} });
    expect(res.status).toBe(404);
  });

  it("does not queue a delegation run when an agent's bot user delegates (loop guard)", async () => {
    const { asOwner, columnId, teamId } = await setup();
    const target = await createInternalAgent(asOwner, 'Target Bot', 'target');
    await agents(
      asOwner,
      teamId,
    )({ agentId: target.id }).patch({
      triggerOnAssign: true,
      delegationDelaySec: 0,
    });
    const actor = (
      await createAgent(asOwner, 'MKT', { name: 'Actor Bot', username: 'actor', kind: 'external' })
    ).data!;
    const asActor = apiKeyApi(actor.apiKey!);
    const issue = (await createIssue(asOwner, columnId)).data!;

    const patched = await asActor
      .issues({ issueId: issue.id })
      .patch({ delegateUserId: target.userId });
    expect(patched.status).toBe(200);
    const created = await asActor
      .projects({ projectKey: 'MKT' })
      .issues.post({ columnId, title: 'Handed over', delegateUserId: target.userId });
    expect(created.status).toBe(201);

    const res = await agents(asOwner, teamId)({ agentId: target.id }).runs.get();
    expect(res.data!.items).toEqual([]);
  });

  it("does not queue a field run when an agent's bot user sets the field (loop guard)", async () => {
    const { asOwner, columnId, teamId } = await setup();
    const target = await createInternalAgent(asOwner, 'Target Bot', 'target');
    const field = await fieldTrigger(asOwner, teamId, target.id, 'Reviewer', 0);
    const actor = (
      await createAgent(asOwner, 'MKT', { name: 'Actor Bot', username: 'actor', kind: 'external' })
    ).data!;
    const asActor = apiKeyApi(actor.apiKey!);
    const issue = (await createIssue(asOwner, columnId)).data!;

    const put = await asActor
      .issues({ issueId: issue.id })
      .fields({ fieldId: field.id })
      .put({ value: target.userId });
    expect(put.status).toBe(200);

    const res = await agents(asOwner, teamId)({ agentId: target.id }).runs.get();
    expect(res.data!.items).toEqual([]);
  });
});
