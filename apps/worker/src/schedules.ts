import { db, agentRun, agentSchedule } from '@repo/db';
import { Cron } from 'croner';
import { eq, sql } from 'drizzle-orm';
import { parseScheduleTimestamp } from './schedule-timestamp';

type DueSchedule = {
  id: number;
  agentId: number;
  // The project the schedule's runs work in, which the run carries rather than
  // reading it back off the agent: an agent works in several projects of its team.
  projectId: number;
  prompt: string;
  cron: string;
  nextRunAt: string;
};

export async function enqueueDueSchedules(): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const rows = (await tx.execute(sql`
      SELECT id, agent_id AS "agentId", project_id AS "projectId", prompt, cron,
             next_run_at AS "nextRunAt"
      FROM agent_schedule
      WHERE status = 'active' AND next_run_at <= now()
      ORDER BY next_run_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT 50
    `)) as unknown as DueSchedule[];

    for (const row of rows) {
      const scheduledFor = parseScheduleTimestamp(row.nextRunAt);
      let next: Date | null;
      try {
        next = new Cron(row.cron, { timezone: 'UTC', paused: true }).nextRun(new Date());
      } catch {
        next = null;
      }
      if (!next) {
        await tx
          .update(agentSchedule)
          .set({ status: 'paused', updatedAt: new Date() })
          .where(eq(agentSchedule.id, row.id));
        continue;
      }
      await tx
        .insert(agentRun)
        .values({
          agentId: row.agentId,
          projectId: row.projectId,
          scheduleId: row.id,
          trigger: 'schedule',
          scheduledFor,
          prompt: row.prompt,
        })
        .onConflictDoNothing();
      await tx
        .update(agentSchedule)
        .set({ nextRunAt: next, lastRunAt: scheduledFor, updatedAt: new Date() })
        .where(eq(agentSchedule.id, row.id));
    }
    return rows.length > 0;
  });
}
