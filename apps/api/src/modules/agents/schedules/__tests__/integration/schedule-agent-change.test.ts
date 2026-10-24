import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { authedApi, createProject, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { createCredential } from '#tests/helpers/integrations';
import { processAgentRuns } from '../../../core/run-poller';
import { getMastra } from '../../../core/runtime/observability';

// A schedule's memory thread is owned by its agent's bot user, and the memory refuses a
// thread to anyone else, so the agent a schedule runs can change only if each agent
// keeps a thread of its own.

// An OpenAI-compatible model that answers every call at once.
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

describe('changing the agent of a schedule', () => {
  let endpoint: ReturnType<typeof Bun.serve>;

  beforeEach(async () => {
    await resetDb();
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
    await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
    const credentialId = await createCredential(asOwner, 'MKT', {
      integrationKey: 'openai-compatible',
      credential: { apiKey: 'sk-test', baseUrl: `http://localhost:${endpoint.port}/v1` },
    });
    const agent = async (name: string, username: string) =>
      (
        await createAgent(asOwner, 'MKT', {
          name,
          username,
          kind: 'internal',
          modelCredentialId: credentialId,
          model: 'any-model',
          memoryEnabled: true,
        })
      ).data!.agent;
    const first = await agent('First', 'first');
    const second = await agent('Second', 'second');
    const schedules = asOwner.projects({ projectKey: 'MKT' })['agent-schedules'];
    const created = await schedules.post({
      agentId: first.id,
      name: 'Digest',
      prompt: 'Summarise the board',
      cron: '0 9 * * *',
    });
    return { asOwner, first, second, scheduleId: created.data!.id };
  }

  async function queueRun(asOwner: Api, scheduleId: number): Promise<number> {
    const queued = await asOwner
      .projects({ projectKey: 'MKT' })
      ['agent-schedules']({ scheduleId })
      .run.post();
    expect(queued.status).toBe(202);
    return queued.data!.runId;
  }

  async function runOf(asOwner: Api, scheduleId: number, runId: number) {
    const runs = await asOwner
      .projects({ projectKey: 'MKT' })
      ['agent-schedules']({ scheduleId })
      .runs.get();
    expect(runs.status).toBe(200);
    return runs.data!.find((run) => run.id === runId);
  }

  it('runs the schedule with the new agent', async () => {
    const { asOwner, second, scheduleId } = await setup();
    const before = await queueRun(asOwner, scheduleId);
    await processAgentRuns();
    expect(await runOf(asOwner, scheduleId, before)).toMatchObject({ status: 'success' });

    const changed = await asOwner
      .projects({ projectKey: 'MKT' })
      ['agent-schedules']({ scheduleId })
      .patch({ agentId: second.id });
    expect(changed.status).toBe(200);
    const after = await queueRun(asOwner, scheduleId);
    await processAgentRuns();

    expect(await runOf(asOwner, scheduleId, after)).toMatchObject({
      status: 'success',
      lastError: null,
    });
  });

  // A run is queued with its agent, so one the previous agent still has queued runs as
  // that agent after the change.
  it('runs a run queued before the change, and the new agent after it', async () => {
    const { asOwner, second, scheduleId } = await setup();
    const queuedBefore = await queueRun(asOwner, scheduleId);
    const changed = await asOwner
      .projects({ projectKey: 'MKT' })
      ['agent-schedules']({ scheduleId })
      .patch({ agentId: second.id });
    expect(changed.status).toBe(200);
    await processAgentRuns();
    expect(await runOf(asOwner, scheduleId, queuedBefore)).toMatchObject({ status: 'success' });

    const after = await queueRun(asOwner, scheduleId);
    await processAgentRuns();

    expect(await runOf(asOwner, scheduleId, after)).toMatchObject({
      status: 'success',
      lastError: null,
    });
  });
});
