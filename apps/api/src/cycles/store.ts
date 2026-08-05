import { db, cycle, issue, projectColumn } from '@repo/db';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { HttpError, iso } from '../shared/lib';

// Data access for cycles: a time-boxed period of work inside a project (a sprint).
// Issues link to a cycle through issue.cycle_id. The status is derived from the
// dates, not stored, and progress is derived from the linked issues' state types.

export type CycleStatus = 'upcoming' | 'active' | 'completed';

export interface CycleProgress {
  completed: number;
  canceled: number;
  total: number;
}

export interface CycleRow {
  id: number;
  projectId: number;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: CycleStatus;
  createdAt: string;
  updatedAt: string;
  progress: CycleProgress;
}

// Compared in UTC against the date columns, so a cycle turns active and completed on
// its own boundary days regardless of the reader's zone.
function cycleStatus(startDate: string, endDate: string): CycleStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return 'upcoming';
  if (today > endDate) return 'completed';
  return 'active';
}

// Issue counts per cycle, grouped by the linked issues' state type. A cycle with no
// issues is simply absent from the map.
async function countsFor(cycleIds: number[]): Promise<Map<number, CycleProgress>> {
  const out = new Map<number, CycleProgress>();
  if (cycleIds.length === 0) return out;
  const rows = await db
    .select({
      cycleId: issue.cycleId,
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${projectColumn.stateType} = 'completed')`,
      canceled: sql<number>`count(*) filter (where ${projectColumn.stateType} = 'canceled')`,
    })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(inArray(issue.cycleId, cycleIds))
    .groupBy(issue.cycleId);
  for (const r of rows) {
    if (r.cycleId == null) continue;
    out.set(r.cycleId, {
      total: Number(r.total),
      completed: Number(r.completed),
      canceled: Number(r.canceled),
    });
  }
  return out;
}

const EMPTY_PROGRESS: CycleProgress = { completed: 0, canceled: 0, total: 0 };

function mapCycle(row: typeof cycle.$inferSelect, progress: CycleProgress): CycleRow {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    goal: row.goal,
    startDate: row.startDate,
    endDate: row.endDate,
    status: cycleStatus(row.startDate, row.endDate),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    progress,
  };
}

// Every cycle of a project, oldest first, so the list reads as a timeline.
export async function listCycles(projectId: number): Promise<CycleRow[]> {
  const rows = await db
    .select()
    .from(cycle)
    .where(eq(cycle.projectId, projectId))
    .orderBy(asc(cycle.startDate), asc(cycle.id));
  const counts = await countsFor(rows.map((r) => r.id));
  return rows.map((row) => mapCycle(row, counts.get(row.id) ?? EMPTY_PROGRESS));
}

export async function getCycle(id: number): Promise<CycleRow | null> {
  const rows = await db.select().from(cycle).where(eq(cycle.id, id));
  if (!rows[0]) return null;
  const counts = await countsFor([id]);
  return mapCycle(rows[0], counts.get(id) ?? EMPTY_PROGRESS);
}

// The project a cycle belongs to, or null if it does not exist. Used by the access
// check on routes that address a cycle by its own id.
export async function getCycleProjectId(id: number): Promise<number | null> {
  const rows = await db.select({ projectId: cycle.projectId }).from(cycle).where(eq(cycle.id, id));
  return rows[0]?.projectId ?? null;
}

// Cycles of one project may not overlap: that is what keeps at most one of them
// active, so "the current cycle" is never ambiguous. excludeId skips the cycle being
// updated. Throws 400 on an overlap, and on a range that ends before it starts (the
// DB check would otherwise surface as a 500).
async function assertRange(
  projectId: number,
  startDate: string,
  endDate: string,
  excludeId?: number,
): Promise<void> {
  if (endDate < startDate) throw new HttpError(400, 'Cycle end date must not precede its start');
  const conds = [
    eq(cycle.projectId, projectId),
    sql`${cycle.startDate} <= ${endDate} and ${cycle.endDate} >= ${startDate}`,
  ];
  if (excludeId !== undefined) conds.push(ne(cycle.id, excludeId));
  const rows = await db
    .select({ id: cycle.id })
    .from(cycle)
    .where(and(...conds))
    .limit(1);
  if (rows.length > 0) throw new HttpError(400, 'Cycle dates overlap another cycle');
}

export interface NewCycleInput {
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
}

export async function createCycle(projectId: number, input: NewCycleInput): Promise<CycleRow> {
  await assertRange(projectId, input.startDate, input.endDate);
  const [row] = await db
    .insert(cycle)
    .values({
      projectId,
      name: input.name,
      goal: input.goal ?? '',
      startDate: input.startDate,
      endDate: input.endDate,
    })
    .returning({ id: cycle.id });
  return (await getCycle(row.id))!;
}

export interface CyclePatch {
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

// How far a cycle's dates may still move, by the state its dates put it in: an
// upcoming one is planning material and moves freely, a running one may only be cut
// short or extended, and a finished one is a record of what happened. The name and
// the goal stay editable throughout — they describe the work, not when it ran.
function assertDatesMovable(status: CycleStatus, movesStart: boolean, movesEnd: boolean): void {
  if (status === 'completed' && (movesStart || movesEnd))
    throw new HttpError(400, 'A completed cycle keeps its dates');
  if (status === 'active' && movesStart)
    throw new HttpError(400, 'A running cycle keeps its start date');
}

// Addressed by its own id (the route's entity guard already resolved the owning
// project and asserted permission). Returns null if the cycle does not exist, which
// the route maps to a 404.
export async function updateCycle(id: number, patch: CyclePatch): Promise<CycleRow | null> {
  const [before] = await db.select().from(cycle).where(eq(cycle.id, id));
  if (!before) return null;
  const movesStart = patch.startDate !== undefined && patch.startDate !== before.startDate;
  const movesEnd = patch.endDate !== undefined && patch.endDate !== before.endDate;
  assertDatesMovable(cycleStatus(before.startDate, before.endDate), movesStart, movesEnd);
  if (movesStart || movesEnd) {
    await assertRange(
      before.projectId,
      patch.startDate ?? before.startDate,
      patch.endDate ?? before.endDate,
      id,
    );
  }

  const set: Partial<typeof cycle.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.goal !== undefined) set.goal = patch.goal;
  if (patch.startDate !== undefined) set.startDate = patch.startDate;
  if (patch.endDate !== undefined) set.endDate = patch.endDate;
  if (Object.keys(set).length > 0) {
    set.updatedAt = sql`now()` as unknown as Date;
    await db.update(cycle).set(set).where(eq(cycle.id, id));
  }
  return getCycle(id);
}

// Linked issues keep existing (issue.cycle_id is set null by the FK).
export async function deleteCycle(id: number): Promise<void> {
  await db.delete(cycle).where(eq(cycle.id, id));
}
