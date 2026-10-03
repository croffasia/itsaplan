import { describe, it, expect } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { db, team, workspace, project, user, aiAgent, agentSchedule, agentRun } from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import { enqueueDueSchedules } from '../../schedules';

async function makeDueSchedule(teamId: number, agentId: number, archivedAt: Date | null) {
  const [projectRow] = await db
    .insert(project)
    .values({ teamId, key: randomUUID().slice(0, 8), name: 'Scheduled', archivedAt })
    .returning({ id: project.id });
  const [row] = await db
    .insert(agentSchedule)
    .values({
      agentId,
      projectId: projectRow!.id,
      name: 'Daily',
      prompt: 'Summarise',
      cron: '0 9 * * *',
      timezone: 'UTC',
      nextRunAt: new Date(Date.now() - 1000),
    })
    .returning({ id: agentSchedule.id });
  return row!.id;
}

describe('enqueueDueSchedules', () => {
  it('queues a due schedule of an active project and skips one of an archived project', async () => {
    const [ws] = await db
      .insert(workspace)
      .values({ name: 'Schedulers' })
      .returning({ id: workspace.id });
    const [teamRow] = await db
      .insert(team)
      .values({ workspaceId: ws!.id, name: 'Schedulers' })
      .returning();
    const userId = randomUUID();
    await db.insert(user).values({ id: userId, name: 'Bot', email: `${userId}@example.test` });
    const [agent] = await db
      .insert(aiAgent)
      .values({ teamId: teamRow!.id, userId, username: 'bot', kind: 'internal' })
      .returning({ id: aiAgent.id });

    const active = await makeDueSchedule(teamRow!.id, agent!.id, null);
    const archived = await makeDueSchedule(teamRow!.id, agent!.id, new Date());

    await enqueueDueSchedules();

    const runs = await db
      .select({ scheduleId: agentRun.scheduleId })
      .from(agentRun)
      .where(inArray(agentRun.scheduleId, [active, archived]));
    expect(runs).toEqual([{ scheduleId: active }]);
    const [skipped] = await db
      .select({ lastRunAt: agentSchedule.lastRunAt })
      .from(agentSchedule)
      .where(eq(agentSchedule.id, archived));
    expect(skipped!.lastRunAt).toBeNull();
  });
});
