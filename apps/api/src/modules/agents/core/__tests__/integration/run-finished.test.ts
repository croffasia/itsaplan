import { describe, it, expect, beforeEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { apiKeyApi, authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { onProjectEvent, type ProjectEvent } from '#modules/webhooks/emit';
import { enqueueAgentRun, markRunFailed, markRunSuccess } from '../../run-queue';

// 'agent_run.finished': the end of a run, for the webhooks and the api's extensions.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const projectId = (await createProject(asOwner, { key: 'MKT', name: 'Marketing' })).data!.id;
  const columnId = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!.columns[0].id;
  return { owner, asOwner, projectId, columnId };
}

// The run events a listener gets while `body` runs, with their payloads.
async function heard(body: () => Promise<void>) {
  const events: (Omit<ProjectEvent, 'load'> & { payloads: unknown[] })[] = [];
  const off = onProjectEvent(async ({ load, ...event }) => {
    if (event.type === 'agent_run.finished') events.push({ ...event, payloads: await load() });
  });
  try {
    await body();
  } finally {
    off();
  }
  return events;
}

describe('agent_run.finished', () => {
  beforeEach(resetDb);

  it("tells listeners and webhooks how an agent's run ended, once", async () => {
    const { asOwner, projectId, columnId } = await setup();
    const agent = (
      await createAgent(asOwner, 'MKT', { name: 'Bot', username: 'bot', kind: 'internal' })
    ).data!.agent;
    const issue = (
      await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' })
    ).data!;
    const hook = (
      await asOwner.projects({ projectKey: 'MKT' }).webhooks.post({
        url: 'https://example.com/hook',
        events: ['agent_run.finished'],
      })
    ).data!.id;
    await enqueueAgentRun({
      agentId: agent.id,
      projectId,
      issueId: issue.id,
      sourceActivityId: null,
      prompt: 'do it',
    });
    const [run] = await db.select().from(agentRun).where(eq(agentRun.issueId, issue.id));

    const events = await heard(async () => {
      await markRunSuccess(run.id, 'Done.', { inputTokens: 10, outputTokens: 2 });
      await markRunFailed(run.id, 'too late');
    });

    expect(events).toEqual([
      {
        projectId,
        type: 'agent_run.finished',
        actor: agent.userId,
        payloads: [
          expect.objectContaining({
            id: run.id,
            status: 'success',
            trigger: 'delegation',
            agent: { id: agent.id, userId: agent.userId, username: 'bot', name: 'Bot' },
            projectId,
            issueId: issue.id,
            issueIdentifier: `MKT-${issue.sequenceNumber}`,
            error: null,
            inputTokens: 10,
            outputTokens: 2,
          }),
        ],
      },
    ]);
    const deliveries = (await asOwner.webhooks({ webhookId: hook }).deliveries.get()).data!.items;
    expect(deliveries.map((d) => d.payload)).toEqual([
      expect.objectContaining({
        action: 'update',
        type: 'AgentRun',
        event: 'agent_run.finished',
        actor: { type: 'agent', id: agent.userId, name: 'Bot' },
        data: expect.objectContaining({ id: run.id, status: 'success' }),
      }),
    ]);
    expect((deliveries[0]!.payload as { data: object }).data).not.toHaveProperty('output');
  });

  it("sends how an external agent's run ended", async () => {
    const { asOwner, columnId } = await setup();
    const created = (
      await createAgent(asOwner, 'MKT', {
        name: 'Ext',
        username: 'ext',
        kind: 'external',
        triggerOnMention: true,
      })
    ).data!;
    const asRunner = apiKeyApi(created.apiKey!);
    const issue = (
      await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' })
    ).data!;
    await asOwner.issues({ issueId: issue.id }).comments.post({ body: 'look @ext' });
    const run = (await asRunner['agent-runs'].claim.post()).data!.run!;

    const events = await heard(async () => {
      await asRunner['agent-runs']({ runId: run.id }).result.post({
        status: 'failed',
        error: 'exit 1',
      });
    });

    expect(events.map((e) => [e.actor, e.payloads])).toEqual([
      [
        created.agent.userId,
        [
          expect.objectContaining({
            id: run.id,
            status: 'failed',
            trigger: 'mention',
            error: 'exit 1',
          }),
        ],
      ],
    ]);
  });

  it('names who canceled the runs', async () => {
    const { owner, asOwner } = await setup();
    const agent = (
      await createAgent(asOwner, 'MKT', { name: 'Hook', username: 'hook', kind: 'external' })
    ).data!.agent;
    const schedules = asOwner.projects({ projectKey: 'MKT' })['agent-schedules'];
    const scheduleId = (
      await schedules.post({
        agentId: agent.id,
        name: 'Daily',
        prompt: 'Triage.',
        cron: '0 9 * * *',
      })
    ).data!.id;
    await schedules({ scheduleId }).run.post();
    await schedules({ scheduleId }).run.post();

    const events = await heard(async () => {
      await schedules({ scheduleId }).runs.cancel.post();
    });

    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe(owner.userId);
    expect(events[0].payloads).toEqual([
      expect.objectContaining({ status: 'canceled', scheduleId, trigger: 'manual', issueId: null }),
      expect.objectContaining({ status: 'canceled', scheduleId, trigger: 'manual', issueId: null }),
    ]);
  });
});
