import { describe, it, expect, beforeEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { authedApi, type Api } from '../../../__tests__/helpers/app';
import { signUpTestUser } from '../../../__tests__/helpers/auth';
import { resetDb } from '../../../__tests__/helpers/db';
import {
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

const agents = (api: Api) => api.projects({ projectKey: 'MKT' })['ai-agents'];

// Creates an internal agent and an issue, then enqueues a pending run for the pair.
async function enqueueRun(asOwner: Api, columnId: number) {
  const agent = (await agents(asOwner).post({ name: 'Bot', username: 'bot', kind: 'internal' }))
    .data!.agent;
  const issue = (
    await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' })
  ).data!;
  await enqueueAgentRun({
    agentId: agent.id,
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

  it('marks a claimed run successful and removes it from the queue', async () => {
    const { asOwner, columnId } = await setup();
    const { runId } = await enqueueRun(asOwner, columnId);
    await claimDueRuns();
    await markRunSuccess(runId);
    expect(await readRun(runId)).toMatchObject({ status: 'success', lastError: null });
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
