import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { createCredential } from '#tests/helpers/integrations';
import { enqueueAgentRun } from '../../run-queue';
import { processAgentRuns } from '../../run-poller';
import { streamAgent } from '../../runtime';
import { getMastra } from '../../runtime/observability';
import { setAgentBuild, type AgentWork } from '../../agent-build';

// An OpenAI-compatible model that answers at once and keeps what each call was sent: the
// instructions and the tools are how the agent an extension built shows.
let sent: {
  messages: { role: string; content: unknown }[];
  tools?: { function: { name: string } }[];
}[] = [];

function reply(stream: boolean): Response {
  const usage = { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 };
  if (!stream) {
    return Response.json({
      id: 'x',
      object: 'chat.completion',
      created: 0,
      model: 'm',
      choices: [
        { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Done.' } },
      ],
      usage,
    });
  }
  const chunk = (choice: object, extra: object = {}) =>
    `data: ${JSON.stringify({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, ...choice }], ...extra })}\n\n`;
  const body =
    chunk({ delta: { role: 'assistant', content: 'Done.' } }) +
    chunk({ delta: {}, finish_reason: 'stop' }, { usage });
  return new Response(`${body}data: [DONE]\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  });
}

const toolsSent = () => (sent.at(-1)?.tools ?? []).map((tool) => tool.function.name);
const systemSent = () =>
  (sent.at(-1)?.messages ?? [])
    .filter((message) => message.role === 'system')
    .map((message) => String(message.content))
    .join('\n');

describe('agent build extension', () => {
  let endpoint: ReturnType<typeof Bun.serve>;

  beforeEach(async () => {
    await resetDb();
    sent = [];
    endpoint = Bun.serve({
      port: 0,
      fetch: async (req) => {
        const body = (await req.json()) as (typeof sent)[number] & { stream?: boolean };
        sent.push(body);
        return reply(Boolean(body.stream));
      },
    });
  });

  afterEach(async () => {
    setAgentBuild();
    await endpoint.stop(true);
    await getMastra().observability.flush();
  });

  async function setup() {
    const owner = await signUpTestUser({ name: 'Owner' });
    const asOwner = authedApi(owner.cookie);
    await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
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
    return { agent, issue };
  }

  it('builds the agent as the core assembles it without an extension', async () => {
    await runOnIssue();
    expect(sent).toHaveLength(1);
    expect(toolsSent()).toContain('get_project');
    expect(toolsSent()).not.toContain('add_issue_watcher');
  });

  it('hands a queued run to the extension and makes the agent from what it returns', async () => {
    const seen: Omit<AgentWork, 'routeTools'>[] = [];
    setAgentBuild((config, { routeTools, ...work }) => {
      seen.push(work);
      return {
        ...config,
        instructions: `${String(config.instructions)}\n\nFollow the house rules.`,
        tools: { ...config.tools, ...routeTools(['add_issue_watcher', 'no_such_tool']) },
      };
    });

    const { agent, issue } = await runOnIssue();

    expect(seen).toEqual([
      {
        agentId: agent.id,
        teamId: agent.teamId,
        projectId: agent.projects[0].id,
        runId: expect.any(Number),
        trigger: 'delegation',
        issueId: issue.id,
      },
    ]);
    expect(systemSent()).toContain('Follow the house rules.');
    expect(toolsSent()).toContain('add_issue_watcher');
    expect(toolsSent()).toContain('get_project');
    expect(toolsSent()).not.toContain('no_such_tool');
  });

  it('hands a chat answer to the extension without a run', async () => {
    const { owner, agent } = await setup();
    const seen: Omit<AgentWork, 'routeTools'>[] = [];
    setAgentBuild((config, { routeTools: _, ...work }) => {
      seen.push(work);
      return config;
    });

    for await (const _event of streamAgent(agent.id, agent.projects[0].id, 'hello', {
      callerUserId: owner.userId,
    }));

    expect(seen).toEqual([
      {
        agentId: agent.id,
        teamId: agent.teamId,
        projectId: agent.projects[0].id,
        runId: undefined,
        trigger: undefined,
        issueId: undefined,
      },
    ]);
  });
});
