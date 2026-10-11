import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { createCredential } from '#tests/helpers/integrations';
import { claimDueRuns, enqueueAgentRun } from '../../run-queue';
import { processAgentRuns } from '../../run-poller';
import { STEP_LIMIT_MESSAGE, streamAgent, type AgentRunEvent } from '../../runtime';

// An OpenAI-compatible model that asks for a tool on every call, so the run ends only
// because it reaches maxSteps; with `answers` set it replies once and stops instead.
let answers = false;
let calls = 0;

function reply(stream: boolean): Response {
  calls++;
  const toolCall = {
    id: `call_${calls}`,
    type: 'function',
    function: { name: 'get_project', arguments: '{}' },
  };
  const text = answers ? 'Done.' : `step ${calls}`;
  const finish = answers ? 'stop' : 'tool_calls';
  if (!stream) {
    const message = {
      role: 'assistant',
      content: text,
      ...(answers ? {} : { tool_calls: [toolCall] }),
    };
    return Response.json({
      id: 'x',
      object: 'chat.completion',
      created: 0,
      model: 'm',
      choices: [{ index: 0, finish_reason: finish, message }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
  }
  const chunk = (choice: object, extra: object = {}) =>
    `data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, ...choice }], ...extra })}\n\n`;
  let body = chunk({ delta: { role: 'assistant', content: text } });
  if (!answers) body += chunk({ delta: { tool_calls: [{ index: 0, ...toolCall }] } });
  body += chunk(
    { delta: {}, finish_reason: finish },
    { usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } },
  );
  return new Response(`${body}data: [DONE]\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('agent run step limit', () => {
  let endpoint: ReturnType<typeof Bun.serve>;

  beforeEach(async () => {
    await resetDb();
    answers = false;
    calls = 0;
    endpoint = Bun.serve({
      port: 0,
      fetch: async (req) => reply(Boolean(((await req.json()) as { stream?: boolean }).stream)),
    });
  });

  afterEach(async () => {
    await endpoint.stop(true);
  });

  async function setup() {
    const owner = await signUpTestUser({ name: 'Owner' });
    const asOwner = authedApi(owner.cookie);
    await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
    const view = await asOwner.projects({ projectKey: 'MKT' }).get();
    const credentialId = await createCredential(asOwner, 'MKT', {
      integrationKey: 'openai-compatible',
      credential: { apiKey: 'sk-test', baseUrl: `http://localhost:${endpoint.port}/v1` },
    });
    const agent = (
      await createAgent(asOwner, 'MKT', {
        name: 'Bot',
        username: 'bot',
        kind: 'internal',
        modelCredentialId: credentialId,
        model: 'any-model',
        maxSteps: 2,
      })
    ).data!.agent;
    return { owner, asOwner, view, agent };
  }

  async function runOnIssue() {
    const { asOwner, view, agent } = await setup();
    const issue = (
      await asOwner
        .projects({ projectKey: 'MKT' })
        .issues.post({ columnId: view.data!.columns[0].id, title: 'Task' })
    ).data!;
    await enqueueAgentRun({
      agentId: agent.id,
      projectId: agent.projects[0].id,
      issueId: issue.id,
      sourceActivityId: null,
      prompt: 'do it',
    });
    await processAgentRuns();
    const runs = await asOwner
      .teams({ teamId: agent.teamId })
      ['ai-agents']({ agentId: agent.id })
      .runs.get({ query: {} });
    return runs.data!.items.find((run) => run.issueId === issue.id)!;
  }

  it('ends a run that reaches maxSteps as failed and does not retry it', async () => {
    const run = await runOnIssue();
    expect(calls).toBe(2);
    expect(run).toMatchObject({ status: 'failed', attempts: 1, lastError: STEP_LIMIT_MESSAGE });
    expect((await claimDueRuns()).find((r) => r.id === run.id)).toBeUndefined();
  });

  it('keeps a run that answers within maxSteps a success', async () => {
    answers = true;
    const run = await runOnIssue();
    expect(run).toMatchObject({ status: 'success', lastError: null, output: 'Done.' });
  });

  it('ends a chat answer that reaches maxSteps with an error', async () => {
    const { owner, agent } = await setup();
    const events: AgentRunEvent[] = [];
    for await (const event of streamAgent(agent.id, agent.projects[0].id, 'hello', {
      callerUserId: owner.userId,
    })) {
      events.push(event);
    }
    expect(events.at(-2)).toEqual({ type: 'error', message: STEP_LIMIT_MESSAGE });
    expect(events.at(-1)?.type).toBe('done');
  });
});
