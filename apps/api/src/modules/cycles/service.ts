import { db, cycle, issue, projectColumn } from '@repo/db';
import { and, asc, desc, eq, ne, sql, type SQL } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';

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

function toCycle(row: typeof cycle.$inferSelect, progress: CycleProgress): CycleRow {
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

// Cycles with their issue counts in one query: the issues hang off each cycle
// through left joins, so a cycle with none stays in the result with zero counts.
// total counts the joined issues, not the rows — `count(*)` would read that empty
// join row as one issue.
function selectCycles(where: SQL | undefined) {
  return db
    .select({
      row: cycle,
      total: sql<number>`count(${issue.id})`,
      completed: sql<number>`count(*) filter (where ${projectColumn.stateType} = 'completed')`,
      canceled: sql<number>`count(*) filter (where ${projectColumn.stateType} = 'canceled')`,
    })
    .from(cycle)
    .leftJoin(issue, eq(issue.cycleId, cycle.id))
    .leftJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(where)
    .groupBy(cycle.id);
}

type CycleAggregate = Awaited<ReturnType<typeof selectCycles>>[number];

function mapCycle(r: CycleAggregate): CycleRow {
  return toCycle(r.row, {
    total: Number(r.total),
    completed: Number(r.completed),
    canceled: Number(r.canceled),
  });
}

// Today in UTC, the same boundary cycleStatus compares against.
const TODAY = sql`(now() at time zone 'utc')::date`;

// Every cycle of a project, oldest first, so the list reads as a timeline.
export async function listCycles(projectId: number): Promise<CycleRow[]> {
  const rows = await selectCycles(eq(cycle.projectId, projectId)).orderBy(
    asc(cycle.startDate),
    asc(cycle.id),
  );
  return rows.map(mapCycle);
}

// The cycles that have not finished yet — active and upcoming — oldest first. This
// is what the cycles page opens with: it stays the same size as a project ages,
// while the finished ones only accumulate and are paged separately.
export async function listPlannedCycles(projectId: number): Promise<CycleRow[]> {
  const rows = await selectCycles(
    and(eq(cycle.projectId, projectId), sql`${cycle.endDate} >= ${TODAY}`),
  ).orderBy(asc(cycle.startDate), asc(cycle.id));
  return rows.map(mapCycle);
}

export interface CyclePage {
  items: CycleRow[];
  total: number;
}

// One page of the finished cycles, newest first — the archive, read back from the
// most recent. `total` counts all of them, not just the page.
export async function listCompletedCycles(
  projectId: number,
  { limit, offset }: { limit: number; offset: number },
): Promise<CyclePage> {
  const where = and(eq(cycle.projectId, projectId), sql`${cycle.endDate} < ${TODAY}`);
  const rows = await selectCycles(where)
    .orderBy(desc(cycle.startDate), desc(cycle.id))
    .limit(limit)
    .offset(offset);
  // Counted separately, not as a window over the page: a page past the end holds no
  // row to carry the count, and the archive still has to say how many there are.
  const [counted] = await db
    .select({ total: sql<number>`count(*)` })
    .from(cycle)
    .where(where);
  return { items: rows.map(mapCycle), total: Number(counted?.total ?? 0) };
}

export async function getCycle(id: number): Promise<CycleRow | null> {
  const [row] = await selectCycles(eq(cycle.id, id));
  return row ? mapCycle(row) : null;
}

// The project a cycle belongs to and the state its dates put it in, or null if it
// does not exist. What the checks on a cycle referenced by its own id read.
export async function getCycleRef(
  id: number,
): Promise<{ projectId: number; status: CycleStatus } | null> {
  const rows = await db
    .select({ projectId: cycle.projectId, startDate: cycle.startDate, endDate: cycle.endDate })
    .from(cycle)
    .where(eq(cycle.id, id));
  const row = rows[0];
  return row ? { projectId: row.projectId, status: cycleStatus(row.startDate, row.endDate) } : null;
}

// Used by the access check on routes that address a cycle by its own id.
export async function getCycleProjectId(id: number): Promise<number | null> {
  return (await getCycleRef(id))?.projectId ?? null;
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
    .returning();
  // A cycle nothing can point at yet, so its progress needs no reading back.
  return toCycle(row, { completed: 0, canceled: 0, total: 0 });
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
