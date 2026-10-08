import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { apiKeyApi, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { clearLimits, setLimits } from '#tests/helpers/limits';
import { createAgent } from '#tests/helpers/agents';
import { enqueueAgentRun } from '../../run-queue';
import { processAgentRuns } from '../../run-poller';
import { setRunAdmission, type RunForAdmission } from '../../run-admission';

// The extension's say on whether a claimed run starts now. The internal agent has no
// model credential, so a run let through fails on the model rather than calling one.

async function setup(kind: 'internal' | 'external') {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const columnId = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!.columns[0].id;
  const created = await createAgent(asOwner, 'MKT', { name: 'Bot', username: 'bot', kind });
  const agent = created.data!.agent;
  const enqueue = async (title: string) => {
    const issue = (await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title }))
      .data!;
    await enqueueAgentRun({
      agentId: agent.id,
      projectId: agent.projects[0].id,
      issueId: issue.id,
      sourceActivityId: null,
      prompt: title,
    });
    const [row] = await db.select().from(agentRun).where(eq(agentRun.issueId, issue.id));
    return row;
  };
  return { agent, enqueue, apiKey: created.data!.apiKey };
}

async function read(id: number) {
  const [row] = await db.select().from(agentRun).where(eq(agentRun.id, id));
  return row;
}

describe('agent run admission', () => {
  beforeEach(resetDb);
  afterEach(() => {
    setRunAdmission();
    clearLimits();
  });

  it('holds back a run of an internal agent without spending an attempt', async () => {
    const { agent, enqueue } = await setup('internal');
    const run = await enqueue('first');
    const asked: RunForAdmission[] = [];
    setRunAdmission(async (claimed) => {
      asked.push(claimed);
      return 120;
    });

    await processAgentRuns();

    expect(asked).toEqual([
      expect.objectContaining({
        id: run.id,
        agentId: agent.id,
        issueId: run.issueId,
        scheduleId: null,
        trigger: 'delegation',
      }),
    ]);
    const after = await read(run.id);
    expect(after).toMatchObject({
      status: 'pending',
      attempts: 0,
      startedAt: null,
      lastError: null,
    });
    expect(after.nextAttemptAt.getTime() - Date.now()).toBeGreaterThan(110_000);
  });

  it('starts the run once the extension lets it through', async () => {
    const { enqueue } = await setup('internal');
    const run = await enqueue('first');

    await processAgentRuns();

    expect(await read(run.id)).toMatchObject({
      attempts: 1,
      lastError: 'Agent has no model credential set',
    });
  });

  it('holds back a run an external runner claims', async () => {
    const { enqueue, apiKey } = await setup('external');
    const run = await enqueue('first');
    setRunAdmission(async () => 60);

    const claimed = await apiKeyApi(apiKey!)['agent-runs'].claim.post();

    expect(claimed.data!.run).toBeNull();
    expect(await read(run.id)).toMatchObject({ status: 'pending', attempts: 0, startedAt: null });
  });

  // One poll claims both runs, and the second waits for the first, which holds its slot
  // until the extension holds it back. On its next attempt the second finds it free.
  it('leaves the slot of a held back run to the workspace', async () => {
    const { enqueue } = await setup('internal');
    const held = await enqueue('first');
    const next = await enqueue('second');
    setLimits({ maxConcurrentRuns: 1 });
    setRunAdmission(async (claimed) => (claimed.id === held.id ? 120 : 0));

    await processAgentRuns();
    expect(await read(held.id)).toMatchObject({ attempts: 0, startedAt: null });
    await db.update(agentRun).set({ nextAttemptAt: new Date() }).where(eq(agentRun.id, next.id));
    await processAgentRuns();

    expect(await read(next.id)).toMatchObject({
      attempts: 1,
      lastError: 'Agent has no model credential set',
    });
  });
});
