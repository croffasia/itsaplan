import { describe, it, expect, beforeEach } from 'bun:test';
import { db } from '@repo/db';
import { sql } from 'drizzle-orm';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { ensureThread, buildMemory } from '../../runtime/memory';
import { createAgent } from '#tests/helpers/agents';

// Agent conversation threads live in Mastra's tables, which carry no foreign key of
// ours, so they are deleted explicitly when what they are bound to goes away: the
// agent, its project, or the schedule. Archiving an issue is reversible and drops
// none of them.
//
// The runtime is not exercised — a live model call would be needed to produce a thread
// — so threads are seeded through the memory module the same way a run creates them.

async function setup() {
  const owner = await signUpTestUser({ name: 'Owner' });
  const asOwner = authedApi(owner.cookie);
  const project = await asOwner.projects.post({ key: 'MKT', name: 'Marketing' });
  const view = await asOwner.projects({ projectKey: 'MKT' }).get();
  return { owner, asOwner, columnId: view.data!.columns[0].id, teamId: project.data!.teamId };
}

// The agent routes of the team the project belongs to, which is where agents live.
const agents = (api: Api, teamId: number) => api.teams({ teamId })['ai-agents'];

async function createInternalAgent(asOwner: Api, name: string, username: string) {
  const res = await createAgent(asOwner, 'MKT', { name, username, kind: 'internal' });
  return res.data!.agent;
}

async function createIssue(asOwner: Api, columnId: number, title: string) {
  const res = await asOwner.projects({ projectKey: 'MKT' }).issues.post({ columnId, title });
  return res.data!;
}

async function seedChatThread(
  threadId: string,
  resourceId: string,
  agent: { id: number; projects: { id: number }[] },
) {
  await ensureThread(
    threadId,
    resourceId,
    { agentId: agent.id, projectId: agent.projects[0].id, kind: 'chat' },
    'chat',
  );
}

async function seedIssueThread(agent: { id: number; projects: { id: number }[] }, issueId: number) {
  const threadId = `issue:${issueId}:${agent.id}`;
  await ensureThread(
    threadId,
    'agent-bot',
    { agentId: agent.id, projectId: agent.projects[0].id, kind: 'run', issueId },
    'run',
  );
  return threadId;
}

async function seedScheduleThread(
  agent: { id: number; projects: { id: number }[] },
  scheduleId: number,
) {
  const threadId = `schedule:${scheduleId}`;
  await ensureThread(
    threadId,
    'agent-bot',
    { agentId: agent.id, projectId: agent.projects[0].id, kind: 'run', scheduleId },
    'run',
  );
  return threadId;
}

const memory = () => buildMemory(20);

async function threadExists(threadId: string): Promise<boolean> {
  return (await memory().getThreadById({ threadId })) != null;
}

// Messages of a deleted thread cannot be read through the memory API (it resolves the
// thread first), so they are counted in Mastra's own table.
async function messageCount(threadId: string): Promise<number> {
  const rows = (await db.execute(
    sql`SELECT count(*)::int AS n FROM mastra_messages WHERE thread_id = ${threadId}`,
  )) as unknown as Array<{ n: number }>;
  return rows[0].n;
}

// Adds one message so the delete is seen to take the transcript with it.
async function seedMessage(threadId: string, resourceId: string) {
  await memory().saveMessages({
    messages: [
      {
        id: crypto.randomUUID(),
        role: 'user' as const,
        type: 'text' as const,
        threadId,
        resourceId,
        createdAt: new Date(),
        content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hi' }] },
      },
    ],
  });
}

describe('agent thread cleanup', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("deletes an agent's chat and run threads with their messages", async () => {
    const { owner, asOwner, columnId, teamId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const other = await createInternalAgent(asOwner, 'Other Bot', 'other');
    const issue = await createIssue(asOwner, columnId, 'Ship it');
    await seedChatThread(`chat:${agent.id}:${owner.userId}:t1`, owner.userId, agent);
    const runThread = await seedIssueThread(agent, issue.id);
    await seedMessage(runThread, 'agent-bot');
    expect(await messageCount(runThread)).toBe(1);
    await seedChatThread(`chat:${other.id}:${owner.userId}:t1`, owner.userId, other);

    const res = await agents(asOwner, teamId)({ agentId: agent.id }).delete();
    expect(res.status).toBe(204);

    expect(await threadExists(`chat:${agent.id}:${owner.userId}:t1`)).toBe(false);
    expect(await threadExists(runThread)).toBe(false);
    expect(await messageCount(runThread)).toBe(0);
    // Another agent's threads are untouched.
    expect(await threadExists(`chat:${other.id}:${owner.userId}:t1`)).toBe(true);
  });

  it("deletes the threads of a project's agents when the project is deleted", async () => {
    const { owner, asOwner, columnId } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const issue = await createIssue(asOwner, columnId, 'Ship it');
    await seedChatThread(`chat:${agent.id}:${owner.userId}:t1`, owner.userId, agent);
    const runThread = await seedIssueThread(agent, issue.id);

    const res = await asOwner.projects({ projectKey: 'MKT' }).delete();
    expect(res.status).toBe(204);

    expect(await threadExists(`chat:${agent.id}:${owner.userId}:t1`)).toBe(false);
    expect(await threadExists(runThread)).toBe(false);
  });

  it("deletes a schedule's run thread when the schedule is deleted", async () => {
    const { asOwner } = await setup();
    const agent = await createInternalAgent(asOwner, 'Design Bot', 'design');
    const schedules = asOwner.projects({ projectKey: 'MKT' })['agent-schedules'];
    const created = await schedules.post({
      agentId: agent.id,
      name: 'Daily digest',
      prompt: 'Summarise the board',
      cron: '0 9 * * *',
    });
    const scheduleId = created.data!.id;
    const thread = await seedScheduleThread(agent, scheduleId);
    await seedMessage(thread, 'agent-bot');

    const res = await schedules({ scheduleId }).delete();
    expect(res.status).toBe(204);

    expect(await threadExists(thread)).toBe(false);
    expect(await messageCount(thread)).toBe(0);
  });

  it("keeps an issue's run threads when it is archived", async () => {
    const { asOwner, columnId } = await setup();
    const a = await createInternalAgent(asOwner, 'Bot A', 'bota');
    const b = await createInternalAgent(asOwner, 'Bot B', 'botb');
    const issue = await createIssue(asOwner, columnId, 'Ship it');
    const threadA = await seedIssueThread(a, issue.id);
    const threadB = await seedIssueThread(b, issue.id);
    await seedMessage(threadA, 'agent-bot');

    const res = await asOwner.issues({ issueId: issue.id }).archive.post();
    expect(res.status).toBe(200);

    expect(await threadExists(threadA)).toBe(true);
    expect(await threadExists(threadB)).toBe(true);
    expect(await messageCount(threadA)).toBe(1);
  });
});
