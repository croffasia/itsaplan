import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { db, agentRun, issueActivity } from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { authedApi, createProject } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { createAgent } from '#tests/helpers/agents';
import { processAgentRuns } from '../../run-poller';
import { setRunRefusal, type InternalWork } from '../../run-refusal';

// The agent has no model credential, so work let through fails on the model rather than
// calling one.

const REASON = 'The agent budget is spent';

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = (await createProject(asOwner, { key: 'MKT', name: 'Marketing' })).data!;
  const columnId = (await asOwner.projects({ projectKey: 'MKT' }).get()).data!.columns[0].id;
  const agent = (
    await createAgent(asOwner, 'MKT', { name: 'Bot', username: 'bot', kind: 'internal' })
  ).data!.agent;
  const issue = (
    await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title: 'Task' })
  ).data!;
  return { owner, asOwner, project, agent, issue };
}

describe('agent run refusal', () => {
  beforeEach(resetDb);
  afterEach(() => setRunRefusal());

  it('fails a refused mention run with the reason, before it starts', async () => {
    const { owner, asOwner, project, agent, issue } = await setup();
    await asOwner.issues({ issueId: issue.id }).comments.post({ body: `please review @bot` });
    const asked: InternalWork[] = [];
    setRunRefusal(async (work) => {
      asked.push(work);
      return REASON;
    });

    await processAgentRuns();

    expect(asked).toEqual([
      { agentId: agent.id, teamId: project.teamId, projectId: project.id, userId: owner.userId },
    ]);
    const [run] = await db.select().from(agentRun).where(eq(agentRun.issueId, issue.id));
    expect(run).toMatchObject({ status: 'failed', attempts: 1, lastError: REASON });
    const started = await db
      .select()
      .from(issueActivity)
      .where(and(eq(issueActivity.issueId, issue.id), eq(issueActivity.action, 'agent_started')));
    expect(started).toEqual([]);
  });

  it('starts a run the extension lets through', async () => {
    const { asOwner, issue } = await setup();
    await asOwner.issues({ issueId: issue.id }).comments.post({ body: `please review @bot` });
    setRunRefusal(async () => null);

    await processAgentRuns();

    const [run] = await db.select().from(agentRun).where(eq(agentRun.issueId, issue.id));
    expect(run).toMatchObject({ attempts: 1, lastError: 'Agent has no model credential set' });
  });

  it('answers a refused chat with the reason', async () => {
    const { owner, asOwner, project, agent } = await setup();
    const asked: InternalWork[] = [];
    setRunRefusal(async (work) => {
      asked.push(work);
      return REASON;
    });

    const res = await asOwner
      .projects({ projectKey: 'MKT' })
      ['ai-agents']({ agentId: agent.id })
      .run.post({ prompt: 'hi' });

    expect(res.status).toBe(403);
    expect(res.error?.value).toMatchObject({ error: REASON, code: 'run_refused' });
    expect(asked).toEqual([
      { agentId: agent.id, teamId: project.teamId, projectId: project.id, userId: owner.userId },
    ]);
  });
});
