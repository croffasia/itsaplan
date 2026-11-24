import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { apiKeyApi, authedApi, type Api, createProject } from '#tests/helpers/app';
import { mcpRpc } from '#tests/helpers/mcp';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { createCredential } from '#tests/helpers/integrations';
import { addProjectMember } from '#tests/helpers/members';
import { processAgentRuns } from '../../run-poller';
import { getMastra } from '../../runtime/observability';

// Who a queued run is for (agent_run.requested_by_user_id): the person who started it, or,
// when an agent sets another to work, the person the first agent was working for.

// A model that first changes the issue with `change`, by default delegating it to the worker,
// then answers.
let change: { issueId: number; delegateUserId?: string; columnId?: number };
let calls = 0;

function reply(stream: boolean): Response {
  calls++;
  const toolCall = {
    id: 'call_1',
    type: 'function',
    function: { name: 'update_issue', arguments: JSON.stringify(change) },
  };
  const answers = calls > 1;
  const finish = answers ? 'stop' : 'tool_calls';
  const usage = { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 };
  if (!stream) {
    const message = {
      role: 'assistant',
      content: answers ? 'Done.' : '',
      ...(answers ? {} : { tool_calls: [toolCall] }),
    };
    return Response.json({
      id: 'x',
      object: 'chat.completion',
      created: 0,
      model: 'm',
      choices: [{ index: 0, finish_reason: finish, message }],
      usage,
    });
  }
  const chunk = (choice: object, extra: object = {}) =>
    `data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, ...choice }], ...extra })}\n\n`;
  const delta = answers
    ? { role: 'assistant', content: 'Done.' }
    : { role: 'assistant', tool_calls: [{ index: 0, ...toolCall }] };
  const body = chunk({ delta }) + chunk({ delta: {}, finish_reason: finish }, { usage });
  return new Response(`${body}data: [DONE]\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('agent run initiator', () => {
  let endpoint: ReturnType<typeof Bun.serve>;

  beforeEach(async () => {
    await resetDb();
    calls = 0;
    endpoint = Bun.serve({
      port: 0,
      fetch: async (req) => reply(Boolean(((await req.json()) as { stream?: boolean }).stream)),
    });
  });

  afterEach(async () => {
    await endpoint.stop(true);
    await getMastra().observability.flush();
  });

  async function setup() {
    const owner = await signUpTestUser({ name: 'Owner' });
    const asOwner = authedApi(owner.cookie);
    const teamId = (await createProject(asOwner, { key: 'MKT', name: 'Marketing' })).data!.teamId;
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    const issueId = (
      await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: view.data!.columns[0].id, title: 'Task' })
    ).data!.id;
    const worker = (
      await createAgent(asOwner, 'MKT', {
        name: 'Worker',
        username: 'worker',
        kind: 'internal',
        triggerOnAssign: true,
      })
    ).data!.agent;
    change = { issueId, delegateUserId: worker.userId };
    return { owner, asOwner, teamId, issueId, worker };
  }

  // The agent that delegates: an internal one on the model above, or an external one.
  async function lead(asOwner: Api, kind: 'internal' | 'external') {
    const model =
      kind === 'internal'
        ? {
            modelCredentialId: await createCredential(asOwner, 'MKT', {
              integrationKey: 'openai-compatible',
              credential: { apiKey: 'sk-test', baseUrl: `http://localhost:${endpoint.port}/v1` },
            }),
            model: 'any-model',
          }
        : {};
    const created = await createAgent(asOwner, 'MKT', {
      name: 'Lead',
      username: 'lead',
      kind,
      tools: ['update_issue'],
      ...model,
    });
    return { agent: created.data!.agent, apiKey: created.data!.apiKey };
  }

  // A tool call of an external agent's MCP client, naming the run it works on as the
  // runner's ITSAPLAN_RUN_ID.
  async function overMcp(apiKey: string, runId: number, args: Record<string, unknown>) {
    const result = await mcpRpc(
      apiKey,
      'tools/call',
      { name: 'update_issue', arguments: args },
      { 'x-itsaplan-run-id': String(runId) },
    );
    expect(result.isError).toBeFalsy();
  }

  async function initiatorsOf(agentId: number) {
    const rows = await db
      .select({ initiator: agentRun.requestedByUserId })
      .from(agentRun)
      .where(eq(agentRun.agentId, agentId));
    return rows.map((row) => row.initiator);
  }

  async function originOf(agentId: number) {
    const [row] = await db
      .select({
        requestedByUserId: agentRun.requestedByUserId,
        startedByUserId: agentRun.startedByUserId,
        parentRunId: agentRun.parentRunId,
        rootRunId: agentRun.rootRunId,
      })
      .from(agentRun)
      .where(eq(agentRun.agentId, agentId));
    return row;
  }

  it('is the person who delegates, mentions or sets the agent in a field', async () => {
    const { owner, asOwner, teamId, issueId, worker } = await setup();
    const field = (
      await asOwner
        .projects({ projectKey: 'MKT' })
        ['custom-fields'].post({ name: 'Reviewer', fieldType: 'member', memberScope: 'agents' })
    ).data!;
    await asOwner
      .teams({ teamId })
      ['ai-agents']({ agentId: worker.id })
      .patch({ fieldTriggers: [{ fieldId: field.id, delaySec: 0 }] });

    await asOwner.issues({ issueId }).patch({ delegateUserId: worker.userId });
    await asOwner.issues({ issueId }).comments.post({ body: 'please look @worker' });
    await asOwner.issues({ issueId }).fields({ fieldId: field.id }).put({ value: worker.userId });

    expect(await initiatorsOf(worker.id)).toEqual([owner.userId, owner.userId, owner.userId]);
  });

  it('is the person who edits a mention into a comment', async () => {
    const { owner, asOwner, issueId, worker } = await setup();
    const asMember = await addProjectMember(asOwner, 'MKT');
    const comment = (await asMember.issues({ issueId }).comments.post({ body: 'see this' })).data!;

    await asOwner.comments({ commentId: comment.id }).patch({ body: 'see this @worker' });

    expect(await initiatorsOf(worker.id)).toEqual([owner.userId]);
  });

  it("passes the person of an internal agent's run on to the agent it delegates to", async () => {
    const { owner, asOwner, issueId, worker } = await setup();
    const { agent } = await lead(asOwner, 'internal');
    await asOwner.issues({ issueId }).comments.post({ body: 'hand this over @lead' });

    await processAgentRuns();

    const [leadRun] = await db
      .select({ id: agentRun.id })
      .from(agentRun)
      .where(eq(agentRun.agentId, agent.id));
    expect(await originOf(worker.id)).toEqual({
      requestedByUserId: owner.userId,
      startedByUserId: agent.userId,
      parentRunId: leadRun.id,
      rootRunId: leadRun.id,
    });
  });

  it("links a schedule's run to the run of the agent whose change started it", async () => {
    const { asOwner, issueId, worker } = await setup();
    const { agent } = await lead(asOwner, 'internal');
    const columnId = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!.columns[1].id;
    await asOwner
      .projects({ projectKey: 'MKT' })
      ['agent-schedules'].post({ agentId: worker.id, name: 'Review', type: 'status', columnId });
    change = { issueId, columnId };
    await asOwner.issues({ issueId }).comments.post({ body: 'move this on @lead' });

    await processAgentRuns();

    const [leadRun] = await db
      .select({ id: agentRun.id })
      .from(agentRun)
      .where(eq(agentRun.agentId, agent.id));
    expect(await originOf(worker.id)).toEqual({
      requestedByUserId: null,
      startedByUserId: agent.userId,
      parentRunId: leadRun.id,
      rootRunId: leadRun.id,
    });
  });

  it("passes the person of an internal agent's chat on to the agent it delegates to", async () => {
    const { owner, asOwner, worker } = await setup();
    const { agent } = await lead(asOwner, 'internal');

    const res = await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId: agent.id })
      .run.stream.post({ prompt: 'hand the task over' });
    for await (const _ of res.data as AsyncIterable<unknown>);

    expect(await originOf(worker.id)).toEqual({
      requestedByUserId: owner.userId,
      startedByUserId: agent.userId,
      parentRunId: null,
      rootRunId: null,
    });
  });

  it("passes an external agent's person on from the run its MCP calls name", async () => {
    const { owner, asOwner, issueId, worker } = await setup();
    const { agent, apiKey } = await lead(asOwner, 'external');
    await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId: agent.id })
      .run.post({ prompt: 'hand the task over' });
    const run = (await apiKeyApi(apiKey!)['agent-runs'].claim.post()).data!.run!;

    await overMcp(apiKey!, run.id, { issueId, delegateUserId: worker.userId });

    expect(await originOf(worker.id)).toEqual({
      requestedByUserId: owner.userId,
      startedByUserId: agent.userId,
      parentRunId: run.id,
      rootRunId: run.id,
    });
  });

  it("takes no work from a run that is not the calling agent's", async () => {
    const { asOwner, issueId, worker } = await setup();
    const { apiKey } = await lead(asOwner, 'external');
    const other = (
      await createAgent(asOwner, 'MKT', { name: 'Other', username: 'other', kind: 'external' })
    ).data!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId: other.agent.id })
      .run.post({ prompt: 'some work' });
    const othersRun = (await apiKeyApi(other.apiKey!)['agent-runs'].claim.post()).data!.run!;

    await overMcp(apiKey!, othersRun.id, { issueId, delegateUserId: worker.userId });

    expect(await originOf(worker.id)).toMatchObject({ requestedByUserId: null, parentRunId: null });
  });

  it('links each run of a chain to the run it came from and to the first one', async () => {
    const { owner, asOwner, issueId, worker } = await setup();
    const first = await lead(asOwner, 'external');
    const middle = (
      await createAgent(asOwner, 'MKT', {
        name: 'Middle',
        username: 'middle',
        kind: 'external',
        triggerOnAssign: true,
        delegationDelaySec: 0,
      })
    ).data!;
    await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId: first.agent.id })
      .run.post({ prompt: 'hand the task over' });
    const rootRun = (await apiKeyApi(first.apiKey!)['agent-runs'].claim.post()).data!.run!;
    await overMcp(first.apiKey!, rootRun.id, { issueId, delegateUserId: middle.agent.userId });
    const middleRun = (await apiKeyApi(middle.apiKey!)['agent-runs'].claim.post()).data!.run!;

    await overMcp(middle.apiKey!, middleRun.id, { issueId, delegateUserId: worker.userId });

    expect(await originOf(middle.agent.id)).toEqual({
      requestedByUserId: owner.userId,
      startedByUserId: first.agent.userId,
      parentRunId: rootRun.id,
      rootRunId: rootRun.id,
    });
    expect(await originOf(worker.id)).toEqual({
      requestedByUserId: owner.userId,
      startedByUserId: middle.agent.userId,
      parentRunId: middleRun.id,
      rootRunId: rootRun.id,
    });
    const listed = (
      await asOwner.projects({ projectKey: 'MKT' })['agent-runs'].queue.get()
    ).data!.items.find((run) => run.agentId === worker.id)!;
    expect(listed).toMatchObject({
      initiator: { name: 'Owner' },
      startedBy: { agentUsername: 'middle' },
      parentRun: { id: middleRun.id, projectRef: listed.projectRef },
      rootRun: { id: rootRun.id, scheduleName: null, initiator: { name: 'Owner' } },
    });
  });

  it('is the project for an agent whose call names no run', async () => {
    const { asOwner, issueId, worker } = await setup();
    const { apiKey } = await lead(asOwner, 'external');

    await apiKeyApi(apiKey!).issues({ issueId }).patch({ delegateUserId: worker.userId });

    expect(await initiatorsOf(worker.id)).toEqual([null]);
  });
});
