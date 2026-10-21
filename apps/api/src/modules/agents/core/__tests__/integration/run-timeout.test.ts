import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { getAgentSettings, setAgentSettings } from '#modules/settings/service';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { clearLimits, setLimits } from '#tests/helpers/limits';
import { createAgent } from '#tests/helpers/agents';
import { createCredential } from '#tests/helpers/integrations';
import { claimDueRuns, enqueueAgentRun } from '../../run-queue';
import { processAgentRuns } from '../../run-poller';
import { getMastra } from '../../runtime/observability';
import { setRunAdmission } from '../../run-admission';

// The service sets limits below the route's 10-second floor to keep the tests short.

describe('agent run timeout', () => {
  let endpoint: ReturnType<typeof Bun.serve>;
  let previousLease: string | undefined;
  let previousSettings: Awaited<ReturnType<typeof getAgentSettings>>;
  let releaseModel: (() => void) | undefined;
  let processing: Promise<void> | undefined;

  beforeEach(async () => {
    await resetDb();
    previousLease = process.env.AGENT_RUN_LEASE_SECONDS;
    previousSettings = await getAgentSettings();
    endpoint = Bun.serve({ port: 0, fetch: () => new Promise<Response>(() => {}) });
  });

  afterEach(async () => {
    clearLimits();
    setRunAdmission();
    if (previousLease === undefined) delete process.env.AGENT_RUN_LEASE_SECONDS;
    else process.env.AGENT_RUN_LEASE_SECONDS = previousLease;
    releaseModel?.();
    try {
      if (processing) await processing;
    } finally {
      await endpoint.stop(true);
      await setAgentSettings(previousSettings);
      await getMastra().observability.flush();
      releaseModel = undefined;
      processing = undefined;
    }
  });

  async function queueRun(runTimeoutSec: number | null = null) {
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
        runTimeoutSec,
      })
    ).data!.agent;
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
    return issue.id;
  }

  async function runOf(issueId: number) {
    const [row] = await db.select().from(agentRun).where(eq(agentRun.issueId, issueId));
    return row;
  }

  it('ends a run that exhausts its time as failed and does not retry it', async () => {
    const issueId = await queueRun();
    setLimits({ maxRunSeconds: 1 });

    await processAgentRuns();

    const row = await runOf(issueId);
    expect(row).toMatchObject({ status: 'failed', attempts: 1, lastError: 'Timed out after 1s' });
    expect((await claimDueRuns()).find((r) => r.id === row.id)).toBeUndefined();
  });

  it("stops a run at the agent's own limit", async () => {
    const issueId = await queueRun(1);

    await processAgentRuns();

    expect(await runOf(issueId)).toMatchObject({
      status: 'failed',
      lastError: 'Timed out after 1s',
    });
  });

  it("caps the agent's limit at the instance maximum", async () => {
    const issueId = await queueRun(600);
    await setAgentSettings({ maxRunSeconds: 1 });

    await processAgentRuns();

    expect(await runOf(issueId)).toMatchObject({
      status: 'failed',
      lastError: 'Timed out after 1s',
    });
  });

  it('claims a run for longer than the instance maximum', async () => {
    const issueId = await queueRun();
    await setAgentSettings({ maxRunSeconds: 1800 });

    await claimDueRuns();

    const [{ leaseSeconds }] = (await db.execute(sql`
      SELECT extract(epoch FROM next_attempt_at - now())::int AS "leaseSeconds"
      FROM agent_run WHERE issue_id = ${issueId}
    `)) as unknown as { leaseSeconds: number }[];
    expect(leaseSeconds).toBeGreaterThan(1800);
  });

  it('keeps a raised instance maximum within the lease already claimed', async () => {
    await endpoint.stop(true);
    let modelTimer: ReturnType<typeof setTimeout> | undefined;
    let finishResponse!: () => void;
    const responseReady = new Promise<void>((resolve) => {
      finishResponse = resolve;
    });
    releaseModel = () => {
      clearTimeout(modelTimer);
      finishResponse();
    };
    endpoint = Bun.serve({
      port: 0,
      async fetch() {
        modelTimer = setTimeout(finishResponse, 3000);
        await responseReady;
        return Response.json({
          id: 'timeout-test',
          object: 'chat.completion',
          created: 0,
          model: 'any-model',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Done.' },
              finish_reason: 'stop',
            },
          ],
        });
      },
    });
    const issueId = await queueRun();
    process.env.AGENT_RUN_LEASE_SECONDS = '1';
    await setAgentSettings({ maxRunSeconds: 1 });
    setRunAdmission(async () => {
      await setAgentSettings({ maxRunSeconds: 1800 });
      return 0;
    });

    processing = processAgentRuns();
    await processing;

    expect(await runOf(issueId)).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastError: 'Timed out after 1s',
    });
  }, 10_000);

  it('does not start a run after admission exhausts the claim execution budget', async () => {
    let modelCalls = 0;
    await endpoint.stop(true);
    endpoint = Bun.serve({
      port: 0,
      fetch() {
        modelCalls++;
        return new Response(null, { status: 500 });
      },
    });
    const issueId = await queueRun();
    process.env.AGENT_RUN_LEASE_SECONDS = '1';
    await setAgentSettings({ maxRunSeconds: 1 });
    setRunAdmission(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return 0;
    });

    await processAgentRuns();

    expect(modelCalls).toBe(0);
    expect(await runOf(issueId)).toMatchObject({
      status: 'pending',
      executionStartedAt: null,
    });
  });
});
