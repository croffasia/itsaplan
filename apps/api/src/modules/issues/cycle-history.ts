import { db, cycle, issueCycle } from '@repo/db';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { iso } from '#shared/lib';
import { cycleStatus, type CycleStatus } from '#modules/cycles/service';

// The cycles an issue was planned into, kept in issue_cycle. issue.cycle_id holds
// only the current one, and the change log records cycle names rather than ids, so
// neither answers how often an issue was carried over. The table keeps every
// stretch, planning that was taken back included — the scope-change metrics count
// those raw stretches.

export interface IssueCycleRow {
  cycleId: number;
  name: string;
  startDate: string;
  endDate: string;
  status: CycleStatus;
  enteredAt: string;
  leftAt: string | null;
}

// Call this from every write that changes issue.cycle_id. A cycle delete needs no
// call — its records go with it.
export async function recordCycleChange(
  issueId: number,
  before: number | null,
  after: number | null,
): Promise<void> {
  if (before === after) return;
  if (before !== null) {
    await db
      .update(issueCycle)
      .set({ leftAt: sql`now()` })
      .where(
        and(
          eq(issueCycle.issueId, issueId),
          eq(issueCycle.cycleId, before),
          isNull(issueCycle.leftAt),
        ),
      );
  }
  if (after !== null) {
    // An open record for this pair already exists when the issue moved back onto a
    // cycle it never left in the table.
    await db.insert(issueCycle).values({ issueId, cycleId: after }).onConflictDoNothing();
  }
}

// The cycles an issue was in, oldest first: the stretches it was still holding when
// the cycle ended, plus the one it holds now. A stretch the issue was planned out of
// before the cycle ended says nothing about where the work happened, so it is
// dropped here. A cycle appears once: an issue that was planned into the same cycle
// twice has its stretches folded into the first entry and the last exit.
export async function listIssueCycles(issueId: number): Promise<IssueCycleRow[]> {
  const rows = await db
    .select({
      cycleId: cycle.id,
      name: cycle.name,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      completedAt: cycle.completedAt,
      enteredAt: issueCycle.enteredAt,
      leftAt: issueCycle.leftAt,
    })
    .from(issueCycle)
    .innerJoin(cycle, eq(cycle.id, issueCycle.cycleId))
    .where(
      and(
        eq(issueCycle.issueId, issueId),
        // Compared in UTC, the zone a cycle's dates are read in everywhere else. A
        // cycle covers its end date, so it ends the day after — unless it was
        // finished early, which ended it at that moment.
        or(
          isNull(issueCycle.leftAt),
          sql`${issueCycle.leftAt} >= coalesce(${cycle.completedAt}, (${cycle.endDate} + interval '1 day') at time zone 'utc')`,
        ),
      ),
    )
    .orderBy(asc(issueCycle.enteredAt), asc(issueCycle.id));
  // Two stretches of one cycle both survive the filter once the cycle's end date is
  // moved back past the moment the issue left it.
  const byCycle = new Map<number, IssueCycleRow>();
  for (const r of rows) {
    const seen = byCycle.get(r.cycleId);
    if (seen) {
      seen.leftAt = r.leftAt ? iso(r.leftAt) : null;
      continue;
    }
    byCycle.set(r.cycleId, {
      cycleId: r.cycleId,
      name: r.name,
      startDate: r.startDate,
      endDate: r.endDate,
      status: cycleStatus(r.startDate, r.endDate, r.completedAt),
      enteredAt: iso(r.enteredAt),
      leftAt: r.leftAt ? iso(r.leftAt) : null,
    });
  }
  return [...byCycle.values()];
}
