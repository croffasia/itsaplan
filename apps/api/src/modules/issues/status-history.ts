import { db, issueStatus, projectColumn } from '@repo/db';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { iso } from '#shared/lib';

// Reads and writes issue_status, the stretches an issue spent in one column.
// issue.column_id holds only the column it is in now, and the change log records
// events rather than state, so neither answers how long the issue stood where.

// Call this from every write that changes issue.column_id, before the change reaches
// the log: the feed groups an entry under the stretch that was open when it was
// written, so a move has to open its stretch first. The open row is closed and the
// new one opened in one transaction, at the same instant, so the two meet. Pass
// `enteredAt` to set that instant — a creation starts its first stretch when the
// issue itself starts.
export async function recordStatusChange(
  issueIds: number[],
  columnId: number,
  enteredAt?: Date,
): Promise<void> {
  if (issueIds.length === 0) return;
  const [column] = await db
    .select({ name: projectColumn.name, stateType: projectColumn.stateType })
    .from(projectColumn)
    .where(eq(projectColumn.id, columnId));
  const at = enteredAt ?? sql`now()`;
  await db.transaction(async (tx) => {
    await tx
      .update(issueStatus)
      .set({ leftAt: at })
      .where(and(inArray(issueStatus.issueId, issueIds), isNull(issueStatus.leftAt)));
    await tx.insert(issueStatus).values(
      issueIds.map((issueId) => ({
        issueId,
        columnId,
        columnName: column.name,
        stateType: column.stateType,
        enteredAt: at,
      })),
    );
  });
}

// --- Status timeline --------------------------------------------------------------
// The issue's life split into the stretches it spent in one column. Backs the
// timeline view of the activity section (a lane per column, bars on a time axis).
// The stretches carry no feed entries: what happened inside one is read on demand
// with listFeedRange when the person opens it.

export interface TimelineSegment {
  // The column the issue was in, under the name it carries now. Null only when the
  // column is gone and the row recorded no name.
  status: string | null;
  from: string;
  // When the issue left this column, or null for the stretch it is in now.
  to: string | null;
  durationMs: number;
}

// Every stretch the issue spent in one column, oldest first. A deleted column falls
// back to the name it had at the time, so the stretches spent in it are still named.
export async function listStatusTimeline(issueId: number): Promise<TimelineSegment[]> {
  const rows = await db
    .select({
      status: sql<string | null>`coalesce(${projectColumn.name}, ${issueStatus.columnName})`,
      enteredAt: issueStatus.enteredAt,
      leftAt: issueStatus.leftAt,
    })
    .from(issueStatus)
    .leftJoin(projectColumn, eq(projectColumn.id, issueStatus.columnId))
    .where(eq(issueStatus.issueId, issueId))
    .orderBy(asc(issueStatus.enteredAt), asc(issueStatus.id));

  const now = Date.now();
  return rows.map((row) => {
    const from = iso(row.enteredAt);
    const to = row.leftAt ? iso(row.leftAt) : null;
    return {
      status: row.status,
      from,
      to,
      durationMs: Math.max(0, (to ? Date.parse(to) : now) - Date.parse(from)),
    };
  });
}
