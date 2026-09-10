import { describe, it, expect, beforeEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent, teamOf } from '#tests/helpers/agents';
import {
  countRunsAhead,
  enqueueAgentRun,
  claimDueRuns,
  markRunSuccess,
  markRunFailed,
  scheduleRunRetry,
} from '../../run-queue';

// The agent_run outbox store: the claim/lease/retry state machine the in-process
// poller drives. The poller itself makes a live LLM call, so it is not exercised
// here; this covers the deterministic queue transitions. agent_run has no API
// surface, so a run is enqueued through the store and its state is read from the db.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  const columnId = view.data!.columns[0].id;
  return { asOwner, columnId };
}

// Creates an internal agent and an issue, then enqueues a pending run for the pair.
async function enqueueRun(asOwner: Api, columnId: number) {
  const agent = (
    await createAgent(asOwner, 'MKT', { name: 'Bot', username: 'bot', kind: 'internal' })
  ).data!.agent;
  const issue = (
    await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' })
  ).data!;
  await enqueueAgentRun({
    agentId: agent.id,
    projectId: agent.projects[0].id,
    issueId: issue.id,
    sourceActivityId: null,
    prompt: 'do it',
  });
  const [row] = await db.select().from(agentRun).where(eq(agentRun.issueId, issue.id));
  return { agent, issue, runId: row.id };
}

async function readRun(runId: number) {
  const [row] = await db.select().from(agentRun).where(eq(agentRun.id, runId));
  return row;
}

describe('agent_run queue store', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('enqueues a run as pending with zero attempts', async () => {
    const { asOwner, columnId } = await setup();
    const { runId } = await enqueueRun(asOwner, columnId);
    expect(await readRun(runId)).toMatchObject({ status: 'pending', attempts: 0, lastError: null });
  });

  it('claims a due run, bumps attempts, and holds the lease so it is not re-claimed', async () => {
    const { asOwner, columnId } = await setup();
    const { runId } = await enqueueRun(asOwner, columnId);

    const first = await claimDueRuns();
    expect(first.find((r) => r.id === runId)).toBeDefined();
    // The lease pushed next_attempt_at into the future while keeping status pending.
    const after = await readRun(runId);
    expect(after).toMatchObject({ status: 'pending', attempts: 1 });
    expect(after.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    // A second immediate claim finds nothing due — the lease is still held.
    const second = await claimDueRuns();
    expect(second.find((r) => r.id === runId)).toBeUndefined();
  });

  it('counts the in-flight runs a run waits behind', async () => {
    const { asOwner, columnId } = await setup();
    const { agent, issue, runId } = await enqueueRun(asOwner, columnId);
    await enqueueAgentRun({
      agentId: agent.id,
      projectId: agent.projects[0].id,
      issueId: issue.id,
      sourceActivityId: null,
      prompt: 'again',
    });
    const teamId = await teamOf(asOwner, 'MKT');
    const [, second] = await db
      .select()
      .from(agentRun)
      .where(eq(agentRun.issueId, issue.id))
      .orderBy(agentRun.id);

    // Queued but unclaimed runs are not under way.
    expect(await countRunsAhead(teamId, second.id)).toBe(0);

    await claimDueRuns();
    expect(await countRunsAhead(teamId, runId)).toBe(0);
    expect(await countRunsAhead(teamId, second.id)).toBe(1);

    // A finished run stops counting, so the next one is no longer held behind it.
    await markRunSuccess(runId, 'done', null);
    expect(await countRunsAhead(teamId, second.id)).toBe(0);
  });

  it('marks a claimed run successful and removes it from the queue', async () => {
    const { asOwner, columnId } = await setup();
    const { runId } = await enqueueRun(asOwner, columnId);
    await claimDueRuns();
    await markRunSuccess(runId, 'done', { inputTokens: 12, outputTokens: 3 });
    expect(await readRun(runId)).toMatchObject({
      status: 'success',
      output: 'done',
      lastError: null,
      inputTokens: 12,
      outputTokens: 3,
    });
  });

  it('marks a run failed and records the error', async () => {
    const { asOwner, columnId } = await setup();
    const { runId } = await enqueueRun(asOwner, columnId);
    await claimDueRuns();
    await markRunFailed(runId, 'boom');
    expect(await readRun(runId)).toMatchObject({ status: 'failed', lastError: 'boom' });
  });

  it('reschedules a retry back to pending with the error and a future attempt time', async () => {
    const { asOwner, columnId } = await setup();
    const { runId } = await enqueueRun(asOwner, columnId);
    await claimDueRuns();
    await scheduleRunRetry(runId, 60_000, 'transient');
    const row = await readRun(runId);
    expect(row).toMatchObject({ status: 'pending', lastError: 'transient' });
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('truncates a long error to the column limit', async () => {
    const { asOwner, columnId } = await setup();
    const { runId } = await enqueueRun(asOwner, columnId);
    await markRunFailed(runId, 'x'.repeat(600));
    expect((await readRun(runId)).lastError).toHaveLength(500);
  });
});
