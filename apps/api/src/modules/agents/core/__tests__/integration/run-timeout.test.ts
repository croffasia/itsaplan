import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { setAgentSettings } from '#modules/settings/service';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { clearLimits, setLimits } from '#tests/helpers/limits';
import { createAgent } from '#tests/helpers/agents';
import { createCredential } from '#tests/helpers/integrations';
import { claimDueRuns, enqueueAgentRun } from '../../run-queue';
import { processAgentRuns } from '../../run-poller';
import { getMastra } from '../../runtime/observability';

// A run that outlasts its time limit. The model endpoint accepts the request and never
// answers, so the run ends only because its abort signal fires. The instance maximum is
// set through the service, which skips the route's 10-second floor.

describe('agent run timeout', () => {
  let endpoint: ReturnType<typeof Bun.serve>;

  beforeEach(async () => {
    await resetDb();
    endpoint = Bun.serve({ port: 0, fetch: () => new Promise<Response>(() => {}) });
  });

  afterEach(async () => {
    clearLimits();
    await endpoint.stop(true);
    await getMastra().observability.flush();
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
});
