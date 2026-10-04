import { db, agentRun, agentSchedule, aiAgent, user } from '@repo/db';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { HttpError, iso, rethrowDuplicate } from '#shared/lib';
import { getTeamLimits } from '#shared/limits';
import { minCronIntervalSeconds } from './cron';
import { agentWorksInProject, canTriggerAgent, isTriggerableBy } from '../core/service';
import { contextTokensOf } from '../core/run-queue';
import { deleteThreadsWhere } from '../core/runtime/memory';

export type AgentScheduleStatus = 'active' | 'paused';

export interface AgentScheduleRow {
  id: number;
  agentId: number;
  agentName: string;
  name: string;
  prompt: string;
  cron: string;
  timezone: 'UTC';
  status: AgentScheduleStatus;
  nextRunAt: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  // Runs that have not been picked up yet — the ones cancelPendingScheduleRuns ends.
  pendingRuns: number;
  // Whether the member reading the schedule may send its agent a task: an 'owner'-scoped
  // runner serves its owner only.
  canTrigger: boolean;
  createdAt: string;
  updatedAt: string;
}

const columns = {
  id: agentSchedule.id,
  agentId: agentSchedule.agentId,
  agentName: user.name,
  name: agentSchedule.name,
  prompt: agentSchedule.prompt,
  cron: agentSchedule.cron,
  timezone: agentSchedule.timezone,
  status: agentSchedule.status,
  nextRunAt: agentSchedule.nextRunAt,
  lastRunAt: agentSchedule.lastRunAt,
  lastRunStatus: sql<string | null>`(
    select r.status from ${agentRun} r
    where r.schedule_id = ${agentSchedule.id}
    order by r.id desc limit 1
  )`,
  pendingRuns: sql<number>`(
    select count(*)::int from ${agentRun} r
    where r.schedule_id = ${agentSchedule.id}
      and r.status = 'pending' and r.started_at is null
  )`,
  createdAt: agentSchedule.createdAt,
  updatedAt: agentSchedule.updatedAt,
  kind: aiAgent.kind,
  runnerScope: aiAgent.runnerScope,
  ownerUserId: aiAgent.ownerUserId,
};

function baseQuery() {
  return db
    .select(columns)
    .from(agentSchedule)
    .innerJoin(aiAgent, eq(aiAgent.id, agentSchedule.agentId))
    .innerJoin(user, eq(user.id, aiAgent.userId));
}

type SelectedSchedule = Awaited<ReturnType<typeof baseQuery>>[number];

function mapSchedule(row: SelectedSchedule, actorUserId: string): AgentScheduleRow {
  const { kind, runnerScope, ownerUserId, ...schedule } = row;
  return {
    ...schedule,
    timezone: 'UTC',
    status: schedule.status as AgentScheduleStatus,
    nextRunAt: iso(schedule.nextRunAt),
    lastRunAt: schedule.lastRunAt ? iso(schedule.lastRunAt) : null,
    canTrigger: isTriggerableBy({ kind, runnerScope, ownerUserId }, actorUserId),
    createdAt: iso(schedule.createdAt),
    updatedAt: iso(schedule.updatedAt),
  };
}

// One page of the project's schedules, newest first, with how many it holds in total.
export async function listAgentSchedules(
  projectId: number,
  actorUserId: string,
  window: { limit: number; offset: number },
): Promise<{ items: AgentScheduleRow[]; total: number }> {
  const [rows, counted] = await Promise.all([
    baseQuery()
      .where(eq(agentSchedule.projectId, projectId))
      .orderBy(desc(agentSchedule.id))
      .limit(window.limit)
      .offset(window.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentSchedule)
      .where(eq(agentSchedule.projectId, projectId)),
  ]);
  return {
    items: rows.map((row) => mapSchedule(row, actorUserId)),
    total: counted[0]?.count ?? 0,
  };
}

// Every schedule of the project, newest first. Not exposed over HTTP — a project copy
// carries all of them over.
export async function listAllAgentSchedules(
  projectId: number,
  actorUserId: string,
): Promise<AgentScheduleRow[]> {
  const rows = await baseQuery()
    .where(eq(agentSchedule.projectId, projectId))
    .orderBy(desc(agentSchedule.id));
  return rows.map((row) => mapSchedule(row, actorUserId));
}

export async function getAgentSchedule(
  projectId: number,
  scheduleId: number,
  actorUserId: string,
): Promise<AgentScheduleRow | null> {
  const rows = await baseQuery().where(
    and(eq(agentSchedule.projectId, projectId), eq(agentSchedule.id, scheduleId)),
  );
  return rows[0] ? mapSchedule(rows[0], actorUserId) : null;
}

// A schedule is a trigger like a mention, so it obeys the same rule: an agent scoped
// to its owner takes tasks from that member only, otherwise anyone in the project
// could send a task to someone else's runner.
async function assertTriggerable(agentId: number, actorUserId: string): Promise<void> {
  if (!(await canTriggerAgent(agentId, actorUserId))) {
    throw new HttpError(403, 'This agent only takes tasks from its owner');
  }
}

// Refuses a cron that fires more often than the workspace's floor allows.
export async function assertScheduleInterval(teamId: number, cron: string): Promise<void> {
  const { minScheduleIntervalSeconds } = await getTeamLimits(teamId);
  if (minScheduleIntervalSeconds === 0) return;
  if (minCronIntervalSeconds(cron) < minScheduleIntervalSeconds) {
    const minutes = Math.ceil(minScheduleIntervalSeconds / 60);
    throw new HttpError(400, `A schedule runs at most once every ${minutes} minutes`);
  }
}

export async function createAgentSchedule(input: {
  projectId: number;
  agentId: number;
  actorUserId: string;
  name: string;
  prompt: string;
  cron: string;
  status: AgentScheduleStatus;
  nextRunAt: Date;
}): Promise<AgentScheduleRow | null> {
  if (!(await agentWorksInProject(input.agentId, input.projectId))) return null;
  await assertTriggerable(input.agentId, input.actorUserId);
  const [row] = await db
    .insert(agentSchedule)
    .values({
      agentId: input.agentId,
      projectId: input.projectId,
      name: input.name,
      prompt: input.prompt,
      cron: input.cron,
      timezone: 'UTC',
      status: input.status,
      nextRunAt: input.nextRunAt,
    })
    .returning({ id: agentSchedule.id })
    .catch((err) => rethrowDuplicate(err, 'schedule for this agent'));
  return getAgentSchedule(input.projectId, row.id, input.actorUserId);
}

export async function updateAgentSchedule(
  projectId: number,
  scheduleId: number,
  patch: {
    agentId?: number;
    name?: string;
    prompt?: string;
    cron?: string;
    status?: AgentScheduleStatus;
    nextRunAt?: Date;
  },
  actorUserId: string,
): Promise<AgentScheduleRow | null> {
  const current = await getAgentSchedule(projectId, scheduleId, actorUserId);
  if (!current) return null;
  if (patch.agentId !== undefined) {
    if (!(await agentWorksInProject(patch.agentId, projectId))) return null;
    await assertTriggerable(patch.agentId, actorUserId);
  }
  await db
    .update(agentSchedule)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(agentSchedule.id, scheduleId))
    .catch((err) => rethrowDuplicate(err, 'schedule for this agent'));
  return getAgentSchedule(projectId, scheduleId, actorUserId);
}

// Deletes a schedule and the conversation thread its runs shared, which lives outside
// the database cascades (see ../core/runtime/memory).
export async function deleteAgentSchedule(
  projectId: number,
  scheduleId: number,
  actorUserId: string,
): Promise<boolean> {
  const current = await getAgentSchedule(projectId, scheduleId, actorUserId);
  if (!current) return false;
  await db.delete(agentSchedule).where(eq(agentSchedule.id, scheduleId));
  await deleteThreadsWhere({ scheduleId });
  return true;
}

export async function enqueueManualScheduleRun(
  projectId: number,
  scheduleId: number,
  actorUserId: string,
): Promise<number | null> {
  const schedule = await getAgentSchedule(projectId, scheduleId, actorUserId);
  if (!schedule) return null;
  await assertTriggerable(schedule.agentId, actorUserId);
  const [run] = await db
    .insert(agentRun)
    .values({
      agentId: schedule.agentId,
      projectId,
      scheduleId,
      trigger: 'manual',
      prompt: schedule.prompt,
    })
    .returning({ id: agentRun.id });
  return run.id;
}

// Ends runs that no worker or runner has picked up yet: a claim stamps started_at, and
// a run already being executed has to finish on its own. 'canceled' is terminal — every
// claim, retry, and result path filters on 'pending'. Null when the schedule is not in
// the project, otherwise how many runs were ended.
export async function cancelPendingScheduleRuns(
  projectId: number,
  scheduleId: number,
  actorUserId: string,
  runId?: number,
): Promise<number | null> {
  const schedule = await getAgentSchedule(projectId, scheduleId, actorUserId);
  if (!schedule) return null;
  await assertTriggerable(schedule.agentId, actorUserId);
  const rows = await db
    .update(agentRun)
    .set({ status: 'canceled', finishedAt: new Date() })
    .where(
      and(
        eq(agentRun.scheduleId, scheduleId),
        eq(agentRun.status, 'pending'),
        isNull(agentRun.startedAt),
        runId != null ? eq(agentRun.id, runId) : undefined,
      ),
    )
    .returning({ id: agentRun.id });
  return rows.length;
}

export interface ScheduleRunRow {
  id: number;
  status: string;
  trigger: string;
  prompt: string;
  attempts: number;
  lastError: string | null;
  output: string | null;
  // What the last model call of the run read and wrote. Absent for a run that finished
  // before this was recorded and for one whose agent reports no counts.
  contextTokens?: number;
  scheduledFor: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export async function listScheduleRuns(
  projectId: number,
  scheduleId: number,
  actorUserId: string,
): Promise<ScheduleRunRow[] | null> {
  const schedule = await getAgentSchedule(projectId, scheduleId, actorUserId);
  if (!schedule) return null;
  const rows = await db
    .select()
    .from(agentRun)
    .where(eq(agentRun.scheduleId, scheduleId))
    .orderBy(desc(agentRun.id))
    .limit(50);
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    trigger: row.trigger,
    prompt: row.prompt,
    attempts: row.attempts,
    lastError: row.lastError,
    output: row.output,
    ...contextTokensOf(row),
    scheduledFor: row.scheduledFor ? iso(row.scheduledFor) : null,
    startedAt: row.startedAt ? iso(row.startedAt) : null,
    finishedAt: row.finishedAt ? iso(row.finishedAt) : null,
    createdAt: iso(row.createdAt),
  }));
}
