import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { clearLimits, setLimits } from '#tests/helpers/limits';
import { createAgent } from '#tests/helpers/agents';
import { createCredential } from '#tests/helpers/integrations';
import { claimDueRuns, enqueueAgentRun } from '../../run-queue';
import { processAgentRuns } from '../../run-poller';

// A run that outlasts the team's maxRunSeconds. The model endpoint accepts the request
// and never answers, so the run ends only because its abort signal fires.

describe('agent run timeout', () => {
  let endpoint: ReturnType<typeof Bun.serve>;

  beforeEach(async () => {
    await resetDb();
    endpoint = Bun.serve({ port: 0, fetch: () => new Promise<Response>(() => {}) });
  });

  afterEach(async () => {
    clearLimits();
    await endpoint.stop(true);
  });

  it('ends a run that exhausts its time as failed and does not retry it', async () => {
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
    setLimits({ maxRunSeconds: 1 });

    await processAgentRuns();

    const [row] = await db.select().from(agentRun).where(eq(agentRun.issueId, issue.id));
    expect(row).toMatchObject({ status: 'failed', attempts: 1, lastError: 'Timed out after 1s' });
    expect((await claimDueRuns()).find((r) => r.id === row.id)).toBeUndefined();
  });
});
