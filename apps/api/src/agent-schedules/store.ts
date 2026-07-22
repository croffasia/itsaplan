import { db, agentRun, agentSchedule, aiAgent, user } from '@repo/db';
import { and, desc, eq, sql } from 'drizzle-orm';
import { iso } from '../shared/lib';

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
  createdAt: agentSchedule.createdAt,
  updatedAt: agentSchedule.updatedAt,
};

function baseQuery() {
  return db
    .select(columns)
    .from(agentSchedule)
    .innerJoin(aiAgent, eq(aiAgent.id, agentSchedule.agentId))
    .innerJoin(user, eq(user.id, aiAgent.userId));
}

type SelectedSchedule = Awaited<ReturnType<typeof baseQuery>>[number];

function mapSchedule(row: SelectedSchedule): AgentScheduleRow {
  return {
    ...row,
    timezone: 'UTC',
    status: row.status as AgentScheduleStatus,
    nextRunAt: iso(row.nextRunAt),
    lastRunAt: row.lastRunAt ? iso(row.lastRunAt) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listAgentSchedules(projectId: number): Promise<AgentScheduleRow[]> {
  const rows = await baseQuery()
    .where(eq(aiAgent.projectId, projectId))
    .orderBy(desc(agentSchedule.id));
  return rows.map(mapSchedule);
}

export async function getAgentSchedule(
  projectId: number,
  scheduleId: number,
): Promise<AgentScheduleRow | null> {
  const rows = await baseQuery().where(
    and(eq(aiAgent.projectId, projectId), eq(agentSchedule.id, scheduleId)),
  );
  return rows[0] ? mapSchedule(rows[0]) : null;
}

export async function createAgentSchedule(input: {
  projectId: number;
  agentId: number;
  name: string;
  prompt: string;
  cron: string;
  status: AgentScheduleStatus;
  nextRunAt: Date;
}): Promise<AgentScheduleRow | null> {
  const agent = await db
    .select({ id: aiAgent.id })
    .from(aiAgent)
    .where(
      and(
        eq(aiAgent.id, input.agentId),
        eq(aiAgent.projectId, input.projectId),
        eq(aiAgent.kind, 'internal'),
      ),
    );
  if (!agent[0]) return null;
  const [row] = await db
    .insert(agentSchedule)
    .values({
      agentId: input.agentId,
      name: input.name,
      prompt: input.prompt,
      cron: input.cron,
      timezone: 'UTC',
      status: input.status,
      nextRunAt: input.nextRunAt,
    })
    .returning({ id: agentSchedule.id });
  return getAgentSchedule(input.projectId, row.id);
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
): Promise<AgentScheduleRow | null> {
  const current = await getAgentSchedule(projectId, scheduleId);
  if (!current) return null;
  if (patch.agentId !== undefined) {
    const agent = await db
      .select({ id: aiAgent.id })
      .from(aiAgent)
      .where(
        and(
          eq(aiAgent.id, patch.agentId),
          eq(aiAgent.projectId, projectId),
          eq(aiAgent.kind, 'internal'),
        ),
      );
    if (!agent[0]) return null;
  }
  await db
    .update(agentSchedule)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(agentSchedule.id, scheduleId));
  return getAgentSchedule(projectId, scheduleId);
}

export async function deleteAgentSchedule(projectId: number, scheduleId: number): Promise<boolean> {
  const current = await getAgentSchedule(projectId, scheduleId);
  if (!current) return false;
  await db.delete(agentSchedule).where(eq(agentSchedule.id, scheduleId));
  return true;
}

export async function enqueueManualScheduleRun(
  projectId: number,
  scheduleId: number,
): Promise<number | null> {
  const schedule = await getAgentSchedule(projectId, scheduleId);
  if (!schedule) return null;
  const [run] = await db
    .insert(agentRun)
    .values({
      agentId: schedule.agentId,
      scheduleId,
      trigger: 'manual',
      prompt: schedule.prompt,
    })
    .returning({ id: agentRun.id });
  return run.id;
}

export interface ScheduleRunRow {
  id: number;
  status: string;
  trigger: string;
  prompt: string;
  attempts: number;
  lastError: string | null;
  output: string | null;
  scheduledFor: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export async function listScheduleRuns(
  projectId: number,
  scheduleId: number,
): Promise<ScheduleRunRow[] | null> {
  const schedule = await getAgentSchedule(projectId, scheduleId);
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
    scheduledFor: row.scheduledFor ? iso(row.scheduledFor) : null,
    startedAt: row.startedAt ? iso(row.startedAt) : null,
    finishedAt: row.finishedAt ? iso(row.finishedAt) : null,
    createdAt: iso(row.createdAt),
  }));
}
