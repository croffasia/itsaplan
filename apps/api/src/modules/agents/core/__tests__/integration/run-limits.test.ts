import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { clearLimits, setLimits } from '#tests/helpers/limits';
import { createAgent } from '#tests/helpers/agents';
import { claimDueRuns, enqueueAgentRun } from '../../run-queue';
import { processAgentRuns } from '../../run-poller';

// The ceiling on the runs a team has in flight, enforced where the poller hands a
// claimed run to the runtime. The agent is left without a model credential, so a run
// that passes the ceiling fails on the model rather than calling one — which is what
// tells "turned away" and "let through" apart.

// Leaves one run of the team in flight and a second one due, which is the pair the
// ceiling is read against. Claiming the first stamps it without running it, so it holds
// a slot for as long as its lease.
async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = view.data!.columns[0].id;
  const agent = (
    await createAgent(asOwner, 'MKT', { name: 'Bot', username: 'bot', kind: 'internal' })
  ).data!.agent;
  const issue = (
    await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' })
  ).data!;
  const projectId = agent.projects[0].id;
  const enqueue = (prompt: string) =>
    enqueueAgentRun({
      agentId: agent.id,
      projectId,
      issueId: issue.id,
      sourceActivityId: null,
      prompt,
    });

  await enqueue('first');
  await claimDueRuns();
  await enqueue('second');
  const [, second] = await db
    .select()
    .from(agentRun)
    .where(eq(agentRun.issueId, issue.id))
    .orderBy(agentRun.id);
  return { second };
}

// Reads the second run back after one poll. A run turned away for a full queue keeps
// the attempts it had; one let through spends an attempt on the model it does not have.
async function pollAndRead(second: { id: number }) {
  await processAgentRuns();
  const [row] = await db.select().from(agentRun).where(eq(agentRun.id, second.id));
  return row;
}

describe('agent run limits', () => {
  beforeEach(resetDb);
  afterEach(clearLimits);

  it('turns away a run the team has no free slot for, leaving it queued', async () => {
    const { second } = await setup();
    setLimits({ maxConcurrentRuns: 1 });

    const row = await pollAndRead(second);
    expect(row).toMatchObject({ status: 'pending', attempts: second.attempts, lastError: null });
  });

  it('lets a run through while the team is under the ceiling', async () => {
    const { second } = await setup();
    setLimits({ maxConcurrentRuns: 2 });

    const row = await pollAndRead(second);
    expect(row.attempts).toBe(second.attempts + 1);
    expect(row.lastError).toBe('Agent has no model credential set');
  });

  it('runs without a ceiling when the instance sets no limits', async () => {
    const { second } = await setup();

    const row = await pollAndRead(second);
    expect(row.attempts).toBe(second.attempts + 1);
    expect(row.lastError).toBe('Agent has no model credential set');
  });
});
