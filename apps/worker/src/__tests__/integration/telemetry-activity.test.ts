import { describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  db,
  workspace,
  team,
  project,
  projectColumn,
  projectDocument,
  issue,
  issueActivity,
  issueStatus,
  user,
  aiAgent,
  agentRun,
  importJob,
} from '@repo/db';
import { readActivity } from '../../telemetry';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function ago(ms: number): Date {
  return new Date(Date.now() - ms);
}

async function makeUser(lastSeenAt: Date | null): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({ id, name: 'Person', email: `${id}@example.test`, lastSeenAt });
  return id;
}

async function makeProject(teamId: number) {
  const [projectRow] = await db
    .insert(project)
    .values({ teamId, key: randomUUID().slice(0, 8), name: 'Activity' })
    .returning({ id: project.id });
  const [columnRow] = await db
    .insert(projectColumn)
    .values({ projectId: projectRow!.id, name: 'Done', position: 1, stateType: 'completed' })
    .returning({ id: projectColumn.id });
  return { projectId: projectRow!.id, columnId: columnRow!.id };
}

async function makeIssue(
  at: { projectId: number; columnId: number },
  delegateUserId: string | null = null,
): Promise<number> {
  const [row] = await db
    .insert(issue)
    .values({
      ...at,
      sequenceNumber: Math.floor(Math.random() * 1_000_000),
      title: 'Task',
      delegateUserId,
    })
    .returning({ id: issue.id });
  return row!.id;
}

async function makeAgent(teamId: number, userId: string, kind: 'internal' | 'external') {
  const [row] = await db
    .insert(aiAgent)
    .values({ teamId, userId, username: `agent-${userId.slice(0, 8)}`, kind })
    .returning({ id: aiAgent.id });
  return row!.id;
}

// The test database is shared, so each count is compared with its value before the test.
function grew(before: Record<string, number>, after: Record<string, number>, key: string) {
  return (after[key] ?? 0) - (before[key] ?? 0);
}

describe('readActivity', () => {
  it('counts the use of the last 24 hours, and people over 7 and 30 days', async () => {
    const before = await readActivity();

    const [ws] = await db.insert(workspace).values({ name: 'Activity' }).returning();
    const [busyTeam] = await db
      .insert(team)
      .values({ workspaceId: ws!.id, name: 'Busy' })
      .returning();
    const [quietTeam] = await db
      .insert(team)
      .values({ workspaceId: ws!.id, name: 'Quiet' })
      .returning();
    const commented = await makeProject(busyTeam!.id);
    const documented = await makeProject(busyTeam!.id);
    const quiet = await makeProject(quietTeam!.id);

    const person = await makeUser(ago(HOUR));
    await makeUser(ago(3 * DAY));
    await makeUser(ago(20 * DAY));
    await makeUser(ago(40 * DAY));
    const internalUser = await makeUser(ago(HOUR));
    const internal = await makeAgent(busyTeam!.id, internalUser, 'internal');
    const external = await makeAgent(busyTeam!.id, await makeUser(null), 'external');

    await db
      .insert(issueActivity)
      .values({ issueId: await makeIssue(commented), kind: 'comment', actorUserId: person });
    await db.insert(issueActivity).values({
      issueId: await makeIssue(quiet),
      kind: 'activity',
      actorUserId: null,
      action: 'archived',
    });
    await db.insert(projectDocument).values({ projectId: documented.projectId, title: 'Notes' });

    await db.insert(issueStatus).values([
      { issueId: await makeIssue(quiet, internalUser), stateType: 'completed' },
      { issueId: await makeIssue(quiet), stateType: 'completed' },
      { issueId: await makeIssue(quiet), stateType: 'completed', enteredAt: ago(2 * DAY) },
    ]);

    const run = { projectId: commented.projectId, prompt: 'Work' };
    await db.insert(agentRun).values([
      { ...run, agentId: internal, trigger: 'mention' },
      { ...run, agentId: internal, trigger: 'delegation' },
      { ...run, agentId: external, trigger: 'manual', createdAt: ago(2 * DAY) },
    ]);

    const job = { projectId: commented.projectId, createdByUserId: person };
    await db.insert(importJob).values([
      { ...job, source: 'Linear', status: 'completed' },
      { ...job, source: 'linear', status: 'failed' },
      { ...job, source: 'trello', status: 'completed', updatedAt: ago(2 * DAY) },
      { ...job, source: 'not a key!', status: 'completed' },
    ]);

    const after = await readActivity();

    // The agent seen an hour ago is not a person.
    expect(after.users1d - before.users1d).toBe(1);
    expect(after.users7d - before.users7d).toBe(2);
    expect(after.users30d - before.users30d).toBe(3);
    // A comment and a document make a project active; a system archive does not.
    expect(after.projects1d - before.projects1d).toBe(2);
    expect(after.teams1d - before.teams1d).toBe(1);
    expect(after.internalAgents1d - before.internalAgents1d).toBe(1);
    expect(after.externalAgents1d - before.externalAgents1d).toBe(0);
    expect(grew(before.runs1d, after.runs1d, 'mention')).toBe(1);
    expect(grew(before.runs1d, after.runs1d, 'delegation')).toBe(1);
    expect(grew(before.runs1d, after.runs1d, 'manual')).toBe(0);
    expect(after.issuesClosedDelegated1d - before.issuesClosedDelegated1d).toBe(1);
    expect(after.issuesClosedUndelegated1d - before.issuesClosedUndelegated1d).toBe(1);
    expect(grew(before.imports1d, after.imports1d, 'linear')).toBe(1);
    expect(grew(before.imports1d, after.imports1d, 'trello')).toBe(0);
    expect(Object.keys(after.imports1d)).not.toContain('not a key!');
  });
});
