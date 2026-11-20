import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { apiKeyApi, authedApi, type Api, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { createCredential } from '#tests/helpers/integrations';
import { addProjectMember } from '#tests/helpers/members';
import { processAgentRuns } from '../../run-poller';
import { getMastra } from '../../runtime/observability';

// Who a queued run is for (agent_run.requested_by_user_id): the person who started it, or,
// when an agent sets another to work, the person the first agent was working for.

// A model that first delegates the issue to the worker, then answers.
let delegation: { issueId: number; delegateUserId: string };
let calls = 0;

function reply(stream: boolean): Response {
  calls++;
  const toolCall = {
    id: 'call_1',
    type: 'function',
    function: { name: 'update_issue', arguments: JSON.stringify(delegation) },
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
    delegation = { issueId, delegateUserId: worker.userId };
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

  async function initiatorsOf(agentId: number) {
    const rows = await db
      .select({ initiator: agentRun.requestedByUserId })
      .from(agentRun)
      .where(eq(agentRun.agentId, agentId));
    return rows.map((row) => row.initiator);
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
    await lead(asOwner, 'internal');
    await asOwner.issues({ issueId }).comments.post({ body: 'hand this over @lead' });

    await processAgentRuns();

    expect(await initiatorsOf(worker.id)).toEqual([owner.userId]);
  });

  it("passes the person of an internal agent's chat on to the agent it delegates to", async () => {
    const { owner, asOwner, worker } = await setup();
    const { agent } = await lead(asOwner, 'internal');

    const res = await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId: agent.id })
      .run.stream.post({ prompt: 'hand the task over' });
    for await (const _ of res.data as AsyncIterable<unknown>);

    expect(await initiatorsOf(worker.id)).toEqual([owner.userId]);
  });

  it("passes an external agent's person on from the run it is at work on", async () => {
    const { owner, asOwner, issueId, worker } = await setup();
    const { agent, apiKey } = await lead(asOwner, 'external');
    await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId: agent.id })
      .run.post({ prompt: 'hand the task over' });
    const asLead = apiKeyApi(apiKey!);
    expect((await asLead['agent-runs'].claim.post()).data!.run).not.toBeNull();

    await asLead.issues({ issueId }).patch({ delegateUserId: worker.userId });

    expect(await initiatorsOf(worker.id)).toEqual([owner.userId]);
  });

  it('is the project for an agent at work on nothing', async () => {
    const { asOwner, issueId, worker } = await setup();
    const { apiKey } = await lead(asOwner, 'external');

    await apiKeyApi(apiKey!).issues({ issueId }).patch({ delegateUserId: worker.userId });

    expect(await initiatorsOf(worker.id)).toEqual([null]);
  });
});
