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

export async function enqueueDueSchedules(): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = (await tx.execute(sql`
      SELECT s.id, s.agent_id AS "agentId", s.project_id AS "projectId", s.prompt, s.cron,
             s.next_run_at AS "nextRunAt"
      FROM agent_schedule s
      JOIN project p ON p.id = s.project_id
      WHERE s.status = 'active' AND s.next_run_at <= now() AND p.archived_at IS NULL
      ORDER BY s.next_run_at, s.id
      FOR UPDATE OF s SKIP LOCKED
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
  });
}
