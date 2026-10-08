import { db, agentRun, agentSchedule, aiAgent, projectColumn, user } from '@repo/db';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { HttpError, iso, rethrowDuplicate } from '#shared/lib';
import { getTeamLimits } from '#shared/limits';
import { minCronIntervalSeconds, nextCronRun } from './cron';
import type { ScheduleOptions } from './extension';
import { agentWorksInProject, canTriggerAgent, isTriggerableBy } from '../core/service';
import { contextTokensOf } from '../core/run-queue';
import { deleteThreadsWhere } from '../core/runtime/memory';

export type AgentScheduleStatus = 'active' | 'paused';
// 'cron', 'status', or a type an extension adds (./extension).
export type AgentScheduleType = string;

export interface AgentScheduleRow {
  id: number;
  agentId: number;
  agentName: string;
  name: string;
  type: AgentScheduleType;
  prompt: string;
  // Set on a 'cron' schedule only, as is nextRunAt.
  cron: string | null;
  timezone: 'UTC';
  // Set on a 'status' schedule only.
  columnId: number | null;
  delaySec: number;
  options: ScheduleOptions;
  status: AgentScheduleStatus;
  nextRunAt: string | null;
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
  type: agentSchedule.type,
  prompt: agentSchedule.prompt,
  cron: agentSchedule.cron,
  timezone: agentSchedule.timezone,
  columnId: agentSchedule.columnId,
  delaySec: agentSchedule.delaySec,
  options: agentSchedule.options,
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
    nextRunAt: schedule.nextRunAt ? iso(schedule.nextRunAt) : null,
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
async function assertScheduleInterval(teamId: number, cron: string): Promise<void> {
  const { minScheduleIntervalSeconds } = await getTeamLimits(teamId);
  if (minScheduleIntervalSeconds === 0) return;
  if (minCronIntervalSeconds(cron) < minScheduleIntervalSeconds) {
    const minutes = Math.ceil(minScheduleIntervalSeconds / 60);
    throw new HttpError(400, `A schedule runs at most once every ${minutes} minutes`);
  }
}

// What starts the schedule's runs, as its columns store it.
interface ScheduleTrigger {
  prompt: string;
  cron: string | null;
  nextRunAt: Date | null;
  columnId: number | null;
  delaySec: number;
}

interface ScheduleTriggerInput {
  prompt?: string;
  cron?: string;
  columnId?: number;
  delaySec?: number;
}

export function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new HttpError(400, `${field} is required`);
  return trimmed;
}

async function assertProjectColumn(projectId: number, columnId: number): Promise<void> {
  const [row] = await db
    .select({ id: projectColumn.id })
    .from(projectColumn)
    .where(and(eq(projectColumn.id, columnId), eq(projectColumn.projectId, projectId)));
  if (!row) throw new HttpError(400, 'Select a column of this project');
}

// Checks the fields of the given type that a write sets, and returns them as stored. A
// field of another type is refused rather than ignored, so a caller that mixes them up
// learns it. An extension's type takes the fields of a 'status' one but the column.
export async function scheduleTriggerFields(
  project: { id: number; teamId: number },
  type: AgentScheduleType,
  input: ScheduleTriggerInput,
): Promise<Partial<ScheduleTrigger>> {
  if (type === 'cron') {
    if (input.columnId !== undefined || input.delaySec !== undefined) {
      throw new HttpError(400, 'A cron schedule takes no column and no delay');
    }
    const out: Partial<ScheduleTrigger> = {};
    if (input.prompt !== undefined) out.prompt = requiredText(input.prompt, 'Task');
    if (input.cron !== undefined) {
      const cron = input.cron.trim();
      await assertScheduleInterval(project.teamId, cron);
      out.cron = cron;
      out.nextRunAt = nextCronRun(cron);
    }
    return out;
  }
  if (input.cron !== undefined) throw new HttpError(400, 'Only a cron schedule takes a cron');
  const out: Partial<ScheduleTrigger> = {};
  if (input.prompt !== undefined) out.prompt = input.prompt.trim();
  if (input.columnId !== undefined) {
    if (type !== 'status') throw new HttpError(400, 'Only a status schedule takes a column');
    await assertProjectColumn(project.id, input.columnId);
    out.columnId = input.columnId;
  }
  if (input.delaySec !== undefined) out.delaySec = input.delaySec;
  return out;
}

// The trigger of a new schedule: the fields its type requires, with the rest left empty.
export async function newScheduleTrigger(
  project: { id: number; teamId: number },
  type: AgentScheduleType,
  input: ScheduleTriggerInput,
): Promise<ScheduleTrigger> {
  if (type === 'cron') {
    if (input.prompt === undefined) throw new HttpError(400, 'Task is required');
    if (input.cron === undefined) throw new HttpError(400, 'Cron is required');
  } else if (type === 'status' && input.columnId === undefined) {
    throw new HttpError(400, 'Column is required');
  }
  const fields = await scheduleTriggerFields(project, type, input);
  return {
    prompt: fields.prompt ?? '',
    cron: fields.cron ?? null,
    nextRunAt: fields.nextRunAt ?? null,
    columnId: fields.columnId ?? null,
    delaySec: fields.delaySec ?? 0,
  };
}

export async function createAgentSchedule(
  input: {
    projectId: number;
    agentId: number;
    actorUserId: string;
    name: string;
    type: AgentScheduleType;
    status: AgentScheduleStatus;
    options: ScheduleOptions;
  } & ScheduleTrigger,
): Promise<AgentScheduleRow | null> {
  if (!(await agentWorksInProject(input.agentId, input.projectId))) return null;
  await assertTriggerable(input.agentId, input.actorUserId);
  const [row] = await db
    .insert(agentSchedule)
    .values({
      agentId: input.agentId,
      projectId: input.projectId,
      name: input.name,
      type: input.type,
      prompt: input.prompt,
      cron: input.cron,
      timezone: 'UTC',
      columnId: input.columnId,
      delaySec: input.delaySec,
      options: input.options,
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
  patch: Partial<ScheduleTrigger> & {
    agentId?: number;
    name?: string;
    options?: ScheduleOptions;
    status?: AgentScheduleStatus;
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
  if (schedule.type !== 'cron') {
    throw new HttpError(400, 'Only a cron schedule runs on demand');
  }
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
