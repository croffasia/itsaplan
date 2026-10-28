import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq, lt, sql } from 'drizzle-orm';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { clearLimits, setLimits } from '#tests/helpers/limits';
import { createAgent } from '#tests/helpers/agents';
import { claimDueRuns, deferRun, enqueueAgentRun, scheduleRunRetry } from '../../run-queue';
import { processAgentRuns } from '../../run-poller';

// The ceilings on the runs in flight at once: the instance's, counted where the poller
// claims runs, and a workspace's, enforced where it hands a claimed run to the runtime.
// The agent is left without a model credential, so a run that passes the ceiling fails
// on the model rather than calling one — which is what tells "turned away" and "let
// through" apart.

// Leaves one run in flight and a second one due, which is the pair the ceiling is read
// against. Claiming the first stamps it without running it, so it holds a slot for as
// long as its lease. With `external`, the first is an external agent's, stamped as its
// runner's claim stamps it. The two work on different issues: a second run on the same
// issue would wait for the first whatever the ceiling.
async function setup({ external = false } = {}) {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await createProject(asOwner, { key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = view.data!.columns[0].id;
  const agent = (
    await createAgent(asOwner, 'MKT', { name: 'Bot', username: 'bot', kind: 'internal' })
  ).data!.agent;
  const projectId = agent.projects[0].id;
  const enqueue = async (title: string, agentId = agent.id) => {
    const issue = (await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title }))
      .data!;
    await enqueueAgentRun({
      agentId,
      projectId,
      issueId: issue.id,
      sourceActivityId: null,
      prompt: title,
    });
    return issue.id;
  };

  if (external) {
    const runner = (
      await createAgent(asOwner, 'MKT', { name: 'Runner', username: 'runner', kind: 'external' })
    ).data!.agent;
    const issueId = await enqueue('first', runner.id);
    await db
      .update(agentRun)
      .set({ startedAt: new Date(), nextAttemptAt: sql`now() + interval '5 minutes'` })
      .where(eq(agentRun.issueId, issueId));
  } else {
    await enqueue('first');
    await claimDueRuns();
  }
  const issueId = await enqueue('second');
  const [second] = await db.select().from(agentRun).where(eq(agentRun.issueId, issueId));
  return { second, asOwner, workspaceId: owner.workspaceId!, enqueue };
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

  it("turns away a run past the workspace's own limit", async () => {
    const { second, asOwner, workspaceId } = await setup();
    await asOwner.workspaces({ workspaceId }).patch({ maxConcurrentRuns: 1 });

    const row = await pollAndRead(second);
    expect(row).toMatchObject({ status: 'pending', attempts: second.attempts, lastError: null });
  });

  it('claims no run past the instance limit, and every due one without a limit', async () => {
    const { second, asOwner } = await setup();

    await asOwner.god['agent-settings'].put({ maxConcurrentRuns: 1 });
    expect(await claimDueRuns()).toEqual([]);

    await asOwner.god['agent-settings'].put({ maxConcurrentRuns: 0 });
    expect((await claimDueRuns()).map((run) => run.id)).toEqual([second.id]);
  });

  // Replicas claim at the same moment: between them they take only the free slots.
  it('lets claims made at once take no more than the free slots', async () => {
    const { asOwner, enqueue } = await setup();
    await enqueue('third');
    await enqueue('fourth');
    await asOwner.god['agent-settings'].put({ maxConcurrentRuns: 3 });

    const claims = await Promise.all([claimDueRuns(), claimDueRuns(), claimDueRuns()]);

    expect(claims.flat()).toHaveLength(2);
  });

  // Neither run executes meanwhile, so neither may keep another workspace's run out.
  it("frees the instance's slot of a run in retry backoff and of a deferred retry", async () => {
    const { second, asOwner } = await setup();
    await asOwner.god['agent-settings'].put({ maxConcurrentRuns: 1 });
    const [first] = await db.select().from(agentRun).where(lt(agentRun.id, second.id));
    const makeDue = (id: number) =>
      db
        .update(agentRun)
        .set({ nextAttemptAt: sql`now()` })
        .where(eq(agentRun.id, id));

    await scheduleRunRetry(first.id, 60_000, 'model down');
    expect((await claimDueRuns()).map((run) => run.id)).toEqual([second.id]);

    await scheduleRunRetry(second.id, 1000, 'model down');
    await makeDue(second.id);
    expect((await claimDueRuns()).map((run) => run.id)).toEqual([second.id]);
    await deferRun(second.id, 30);
    await makeDue(first.id);
    expect((await claimDueRuns()).map((run) => run.id)).toEqual([first.id]);
  });

  it('leaves the runs of external agents out of both limits', async () => {
    const { second, asOwner, workspaceId } = await setup({ external: true });
    await asOwner.god['agent-settings'].put({ maxConcurrentRuns: 1 });
    await asOwner.workspaces({ workspaceId }).patch({ maxConcurrentRuns: 1 });

    const row = await pollAndRead(second);
    expect(row.attempts).toBe(second.attempts + 1);
    expect(row.lastError).toBe('Agent has no model credential set');
  });
});
