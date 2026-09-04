import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { db, agentRun } from '@repo/db';
import { eq } from 'drizzle-orm';
import { api, authedApi } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { clearLimits, setLimits } from '#tests/helpers/limits';
import { createAgent } from '#tests/helpers/agents';
import { claimDueRuns, enqueueAgentRun } from '../../run-queue';

// The ceiling on the runs a team has in flight, enforced where the worker hands a
// claimed run to the runtime. The agent is left without a model credential, so a run
// that passes the ceiling fails on the model rather than calling one — which is what
// tells "turned away" and "let through" apart.

const WORKER_TOKEN = 'run-limits-test-worker-token';

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
  for (const prompt of ['first', 'second'])
    await enqueueAgentRun({
      agentId: agent.id,
      projectId,
      issueId: issue.id,
      sourceActivityId: null,
      prompt,
    });
  // Claiming stamps both runs, which is what makes them count as in flight.
  await claimDueRuns();
  const [first, second] = await db
    .select()
    .from(agentRun)
    .where(eq(agentRun.issueId, issue.id))
    .orderBy(agentRun.id);

  return { agent, issue, projectId, first, second };
}

type Setup = Awaited<ReturnType<typeof setup>>;

function execute({ agent, issue, projectId }: Setup, run: { id: number; attempts: number }) {
  return api.internal['agent-runs'].execute.post(
    {
      id: run.id,
      agentId: agent.id,
      issueId: issue.id,
      scheduleId: null,
      trigger: 'delegation',
      prompt: 'do it',
      attempts: run.attempts,
      projectId,
      agentUserId: agent.userId,
      issueIdentifier: null,
      issueTitle: issue.title,
      assigneeName: null,
      requesterName: null,
    },
    { headers: { 'x-worker-token': WORKER_TOKEN } },
  );
}

describe('agent run limits', () => {
  let previousToken: string | undefined;

  beforeEach(async () => {
    previousToken = process.env.WORKER_INTERNAL_TOKEN;
    process.env.WORKER_INTERNAL_TOKEN = WORKER_TOKEN;
    await resetDb();
  });

  afterEach(() => {
    if (previousToken == null) delete process.env.WORKER_INTERNAL_TOKEN;
    else process.env.WORKER_INTERNAL_TOKEN = previousToken;
    clearLimits();
  });

  it('turns away a run the team has no free slot for, leaving it queued', async () => {
    const state = await setup();
    setLimits({ maxConcurrentRuns: 1 });

    const res = await execute(state, state.second);
    expect(res.status).toBe(503);

    const [row] = await db.select().from(agentRun).where(eq(agentRun.id, state.second.id));
    expect(row).toMatchObject({ status: 'pending', attempts: state.second.attempts });
  });

  it('lets a run through while the team is under the ceiling', async () => {
    const state = await setup();
    setLimits({ maxConcurrentRuns: 2 });

    const res = await execute(state, state.second);
    expect(res.status).toBe(400);
    // Treaty types the error body as its validation shape, which the message is not.
    expect(String(res.error!.value)).toBe('Agent has no model credential set');
  });

  it('runs without a ceiling when the instance sets no limits', async () => {
    const state = await setup();

    const res = await execute(state, state.second);
    expect(res.status).toBe(400);
  });
});
