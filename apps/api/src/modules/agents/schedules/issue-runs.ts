import { db, agentRun, agentSchedule, aiAgent, issue, project, projectColumn } from '@repo/db';
import { and, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import { filterScheduleIssues, type ScheduleForExtension } from './extension';

// The runs schedules queue on issues: a 'status' schedule's when an issue enters its
// column, and those of an extension's types when the extension calls queueScheduleRuns.
// Every write that puts issues into a column calls queueStatusRuns, next to
// recordStatusChange.

type IssueLead = (issue: { identifier: string; title: string }) => string;

interface IssueSchedule extends ScheduleForExtension {
  prompt: string;
  delaySec: number;
  // Opens the run's prompt: the issue and what happened to it.
  lead: IssueLead;
}

const scheduleFields = {
  id: agentSchedule.id,
  agentId: agentSchedule.agentId,
  projectId: agentSchedule.projectId,
  type: agentSchedule.type,
  options: agentSchedule.options,
  prompt: agentSchedule.prompt,
  delaySec: agentSchedule.delaySec,
};

// An agent that made the change does not start its own schedule.
function notActor(actorUserId: string | null | undefined) {
  return actorUserId ? ne(aiAgent.userId, actorUserId) : undefined;
}

// Ends the status runs of the given issues that belong to another column and have not
// started, so an issue moved on before its run starts does not start it. A run deferred
// before it started has not started either: deferRun sets its attempts back to 0.
// Then queues a run of every active status schedule of the column on each issue.
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
    .select({ ...scheduleFields, columnName: projectColumn.name })
    .from(agentSchedule)
    .innerJoin(aiAgent, eq(aiAgent.id, agentSchedule.agentId))
    .innerJoin(projectColumn, eq(projectColumn.id, agentSchedule.columnId))
    .where(
      and(
        eq(agentSchedule.columnId, columnId),
        eq(agentSchedule.status, 'active'),
        notActor(actorUserId),
      ),
    );
  await insertIssueRuns(
    schedules.map((schedule) => ({
      ...schedule,
      lead: (row) =>
        `Work item ${row.identifier}: "${row.title}" entered the "${schedule.columnName}" status.`,
    })),
    issueIds,
  );
}

// Queues a run of each of the schedules on each of the issues, for an extension that
// starts the schedules of its own types. A schedule of a core type or a paused one is
// skipped, as is an issue of another project than the schedule's.
export async function queueScheduleRuns(
  scheduleIds: number[],
  issueIds: number[],
  actorUserId: string | null | undefined,
  lead: IssueLead,
): Promise<void> {
  if (scheduleIds.length === 0 || issueIds.length === 0) return;
  const schedules = await db
    .select(scheduleFields)
    .from(agentSchedule)
    .innerJoin(aiAgent, eq(aiAgent.id, agentSchedule.agentId))
    .where(
      and(
        inArray(agentSchedule.id, scheduleIds),
        notInArray(agentSchedule.type, ['cron', 'status']),
        eq(agentSchedule.status, 'active'),
        notActor(actorUserId),
      ),
    );
  await insertIssueRuns(
    schedules.map((schedule) => ({ ...schedule, lead })),
    issueIds,
  );
}

async function insertIssueRuns(schedules: IssueSchedule[], issueIds: number[]): Promise<void> {
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

  const perSchedule = await Promise.all(
    schedules.map(async (schedule) => {
      const own = issues.filter((row) => row.projectId === schedule.projectId);
      if (own.length === 0) return [];
      const allowed = new Set(
        await filterScheduleIssues(
          schedule,
          own.map((row) => row.id),
        ),
      );
      return own
        .filter((row) => allowed.has(row.id))
        .map((row) => ({
          agentId: schedule.agentId,
          projectId: row.projectId,
          issueId: row.id,
          scheduleId: schedule.id,
          trigger: schedule.type === 'status' ? 'status' : 'event',
          prompt: issueRunPrompt(schedule.lead(row), schedule.prompt),
          nextAttemptAt: sql`now() + make_interval(secs => ${schedule.delaySec})`,
        }));
    }),
  );
  const runs = perSchedule.flat();
  if (runs.length === 0) return;
  await db.insert(agentRun).values(runs);
  await db
    .update(agentSchedule)
    .set({ lastRunAt: new Date() })
    .where(inArray(agentSchedule.id, [...new Set(runs.map((run) => run.scheduleId))]));
}

function issueRunPrompt(lead: string, task: string): string {
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
