import { db, agentRun, agentSchedule, aiAgent, issue, project, projectColumn } from '@repo/db';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';

// The runs of 'status' schedules. Every write that puts issues into a column calls
// queueStatusRuns, next to recordStatusChange.

// Ends the status runs of the given issues that belong to another column and have not
// started, so an issue moved on before its run starts does not start it. A run deferred
// for want of a free slot has not started either: deferRun sets its attempts back to 0.
// Then queues a run of every active status schedule of the column on each issue. An
// agent that moved the issue itself does not start its own schedule.
export async function queueStatusRuns(
  issueIds: number[],
  columnId: number,
  actorUserId: string | null | undefined,
): Promise<void> {
  if (issueIds.length === 0) return;
  await db
    .update(agentRun)
    .set({ status: 'canceled', finishedAt: new Date() })
    .where(
      and(
        inArray(agentRun.issueId, issueIds),
        eq(agentRun.trigger, 'status'),
        eq(agentRun.status, 'pending'),
        eq(agentRun.attempts, 0),
        sql`${agentRun.scheduleId} IN (
          select ${agentSchedule.id} from ${agentSchedule}
          where ${agentSchedule.columnId} <> ${columnId}
        )`,
      ),
    );

  const schedules = await db
    .select({
      id: agentSchedule.id,
      agentId: agentSchedule.agentId,
      prompt: agentSchedule.prompt,
      delaySec: agentSchedule.delaySec,
      columnName: projectColumn.name,
    })
    .from(agentSchedule)
    .innerJoin(aiAgent, eq(aiAgent.id, agentSchedule.agentId))
    .innerJoin(projectColumn, eq(projectColumn.id, agentSchedule.columnId))
    .where(
      and(
        eq(agentSchedule.columnId, columnId),
        eq(agentSchedule.status, 'active'),
        actorUserId ? ne(aiAgent.userId, actorUserId) : undefined,
      ),
    );
  if (schedules.length === 0) return;

  const issues = await db
    .select({
      id: issue.id,
      projectId: issue.projectId,
      title: issue.title,
      identifier: sql<string>`${project.key} || '-' || ${issue.sequenceNumber}`,
    })
    .from(issue)
    .innerJoin(project, eq(project.id, issue.projectId))
    .where(inArray(issue.id, issueIds));
  if (issues.length === 0) return;

  await db.insert(agentRun).values(
    schedules.flatMap((schedule) =>
      issues.map((row) => ({
        agentId: schedule.agentId,
        projectId: row.projectId,
        issueId: row.id,
        scheduleId: schedule.id,
        trigger: 'status',
        prompt: statusRunPrompt(row, schedule.columnName, schedule.prompt),
        nextAttemptAt: sql`now() + make_interval(secs => ${schedule.delaySec})`,
      })),
    ),
  );
  await db
    .update(agentSchedule)
    .set({ lastRunAt: new Date() })
    .where(
      inArray(
        agentSchedule.id,
        schedules.map((schedule) => schedule.id),
      ),
    );
}

function statusRunPrompt(
  row: { identifier: string; title: string },
  columnName: string,
  task: string,
): string {
  const lead = `Work item ${row.identifier}: "${row.title}" entered the "${columnName}" status.`;
  return task ? `${lead}\n\n${task}` : `${lead} Review it and take the appropriate next step.`;
}

// Whether a status schedule of the column has a run that has not finished: one waiting
// out its delay or one being executed. Deleting the column deletes the schedule and
// its runs with it.
export async function hasUnfinishedStatusRuns(columnId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: agentRun.id })
    .from(agentRun)
    .innerJoin(agentSchedule, eq(agentSchedule.id, agentRun.scheduleId))
    .where(and(eq(agentSchedule.columnId, columnId), eq(agentRun.status, 'pending')))
    .limit(1);
  return row != null;
}
