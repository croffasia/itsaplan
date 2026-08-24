import { db, issue, issueWorklog, user } from '@repo/db';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import { recordActivity, timeText } from './activity';

// The time members logged on an issue, one row per entry. The time an issue took is
// the sum of its entries, computed on read.

export interface WorklogRow {
  id: number;
  issueId: number;
  userId: string;
  userName: string | null;
  userImage: string | null;
  minutes: number;
  spentOn: string;
  note: string | null;
  createdAt: string;
}

export interface WorklogInput {
  minutes: number;
  spentOn: string;
  note?: string | null;
}

const worklogColumns = {
  id: issueWorklog.id,
  issueId: issueWorklog.issueId,
  userId: issueWorklog.userId,
  userName: user.name,
  userImage: user.image,
  minutes: issueWorklog.minutes,
  spentOn: issueWorklog.spentOn,
  note: issueWorklog.note,
  createdAt: issueWorklog.createdAt,
};

function mapWorklog(row: Omit<WorklogRow, 'createdAt'> & { createdAt: Date }): WorklogRow {
  return { ...row, createdAt: iso(row.createdAt) };
}

function worklogSide(entry: { id: number; minutes: number; spentOn: string }) {
  return { value: timeText(entry.minutes), id: entry.id, date: entry.spentOn };
}

// Rejects a day the work cannot have happened on yet. Today is the server's, so a
// member ahead of UTC logs their own late evening on the day it starts here.
function assertNotFuture(spentOn: string): void {
  if (spentOn > new Date().toISOString().slice(0, 10))
    throw new HttpError(400, 'Time cannot be logged on a future day');
}

// Every entry of an issue, the newest day first and the newest entry first within a
// day. The author's name and picture come along, so the section names them without
// a lookup of its own.
export async function listWorklogs(issueId: number): Promise<WorklogRow[]> {
  const rows = await db
    .select(worklogColumns)
    .from(issueWorklog)
    .innerJoin(user, eq(user.id, issueWorklog.userId))
    .where(eq(issueWorklog.issueId, issueId))
    .orderBy(desc(issueWorklog.spentOn), desc(issueWorklog.id));
  return rows.map(mapWorklog);
}

// Sums each issue's logged time and merges it onto the issues in place, leaving the
// zero mapIssue set for an issue nothing was logged on. One grouped query for the
// whole set, the same shape as the other per-issue enrichment.
export async function attachLoggedMinutes<T extends { id: number; loggedMinutes: number }>(
  issues: T[],
): Promise<void> {
  if (issues.length === 0) return;
  const rows = await db
    .select({
      issueId: issueWorklog.issueId,
      minutes: sql<number>`sum(${issueWorklog.minutes})::int`,
    })
    .from(issueWorklog)
    .where(
      inArray(
        issueWorklog.issueId,
        issues.map((i) => i.id),
      ),
    )
    .groupBy(issueWorklog.issueId);
  const byIssue = new Map(rows.map((row) => [row.issueId, row.minutes]));
  for (const i of issues) i.loggedMinutes = byIssue.get(i.id) ?? 0;
}

// The entry a route guard resolves: the issue it hangs on, the project behind that
// issue, and the member who logged it, which decides whether the caller may touch
// it. Null when there is no such entry.
export async function getWorklogRef(
  worklogId: number,
): Promise<{ issueId: number; projectId: number; userId: string } | null> {
  const rows = await db
    .select({
      issueId: issueWorklog.issueId,
      projectId: issue.projectId,
      userId: issueWorklog.userId,
    })
    .from(issueWorklog)
    .innerJoin(issue, eq(issue.id, issueWorklog.issueId))
    .where(eq(issueWorklog.id, worklogId));
  return rows[0] ?? null;
}

export async function createWorklog(
  issueId: number,
  userId: string,
  input: WorklogInput,
): Promise<WorklogRow> {
  assertNotFuture(input.spentOn);
  const [row] = await db
    .insert(issueWorklog)
    .values({
      issueId,
      userId,
      minutes: input.minutes,
      spentOn: input.spentOn,
      note: input.note ?? null,
    })
    .returning({ id: issueWorklog.id });

  await recordActivity(
    issueId,
    [{ action: 'worklog', to: worklogSide({ id: row.id, ...input }) }],
    userId,
  );
  return requireWorklog(row.id);
}

// One entry with its author, for the routes that return the row they wrote.
async function requireWorklog(worklogId: number): Promise<WorklogRow> {
  const rows = await db
    .select(worklogColumns)
    .from(issueWorklog)
    .innerJoin(user, eq(user.id, issueWorklog.userId))
    .where(eq(issueWorklog.id, worklogId));
  if (!rows[0]) throw new HttpError(404, 'Time entry not found');
  return mapWorklog(rows[0]);
}

// Changes an entry. The feed keeps what it held before, so a correction can be read
// against the time it replaced. Who may change whose is settled by the route guard.
export async function updateWorklog(
  worklogId: number,
  patch: Partial<WorklogInput>,
  actorUserId?: string | null,
): Promise<WorklogRow> {
  // Every field is optional, so a patch can carry none. Drizzle rejects an empty
  // `set`, and there would be nothing to write anyway.
  if (Object.keys(patch).length === 0) return requireWorklog(worklogId);
  if (patch.spentOn !== undefined) assertNotFuture(patch.spentOn);

  const [previous] = await db
    .select({
      id: issueWorklog.id,
      issueId: issueWorklog.issueId,
      minutes: issueWorklog.minutes,
      spentOn: issueWorklog.spentOn,
    })
    .from(issueWorklog)
    .where(eq(issueWorklog.id, worklogId));
  if (!previous) throw new HttpError(404, 'Time entry not found');

  const [row] = await db
    .update(issueWorklog)
    .set(patch)
    .where(eq(issueWorklog.id, worklogId))
    .returning({ minutes: issueWorklog.minutes, spentOn: issueWorklog.spentOn });

  if (row.minutes !== previous.minutes || row.spentOn !== previous.spentOn) {
    await recordActivity(
      previous.issueId,
      [
        {
          action: 'worklog',
          from: worklogSide(previous),
          to: worklogSide({ id: worklogId, ...row }),
        },
      ],
      actorUserId,
    );
  }
  return requireWorklog(worklogId);
}

// Deletes an entry, lowering the issue's logged time by that entry alone. Returns
// false when there is no such entry.
export async function deleteWorklog(
  worklogId: number,
  actorUserId?: string | null,
): Promise<boolean> {
  const [removed] = await db.delete(issueWorklog).where(eq(issueWorklog.id, worklogId)).returning({
    id: issueWorklog.id,
    issueId: issueWorklog.issueId,
    minutes: issueWorklog.minutes,
    spentOn: issueWorklog.spentOn,
  });
  if (!removed) return false;

  await recordActivity(
    removed.issueId,
    [{ action: 'worklog', from: worklogSide(removed) }],
    actorUserId,
  );
  return true;
}
