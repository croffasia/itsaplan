import { db, issue, issueLink, projectColumn } from '@repo/db';
import { and, eq, exists, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { HttpError } from '#shared/lib';
import type { ActivityActor } from './activity';
import { updateIssue } from './service';

// The project's blocked column (project_column.blocked) holds the issues that cannot
// go on. A person moves an issue there with a reason. An issue that an open issue
// blocks is moved there without one, and moved back to the column it came from once
// no open issue blocks it. An issue with a reason stays until someone moves it out.

const CLOSED_STATE_TYPES = ['completed', 'canceled'];

// A person moving an issue into the blocked column says why.
export function blockedReasonRequired(): HttpError {
  return new HttpError(
    400,
    'Enter a reason to move an issue to the blocked column',
    'blocked_reason_required',
  );
}

// Only work that is planned or under way is held up. A backlog issue is not started,
// and a closed one has nothing left to wait for. The blocked column is one of these
// types too, so an issue in it still counts as open work.
export const BLOCKABLE_STATE_TYPES = ['unstarted', 'started'];

// An open 'blocks' link to the issue: its source is active and not in a closed column.
export function openBlockerOf(issueId: typeof issue.id) {
  const blocker = alias(issue, 'blocker');
  const blockerColumn = alias(projectColumn, 'blocker_column');
  return exists(
    db
      .select({ one: sql`1` })
      .from(issueLink)
      .innerJoin(blocker, eq(blocker.id, issueLink.sourceIssueId))
      .innerJoin(blockerColumn, eq(blockerColumn.id, blocker.columnId))
      .where(
        and(
          eq(issueLink.targetIssueId, issueId),
          eq(issueLink.kind, 'blocks'),
          isNull(blocker.archivedAt),
          notInArray(blockerColumn.stateType, CLOSED_STATE_TYPES),
        ),
      ),
  );
}

export async function blockedColumnId(projectId: number): Promise<number | null> {
  const [row] = await db
    .select({ id: projectColumn.id })
    .from(projectColumn)
    .where(and(eq(projectColumn.projectId, projectId), eq(projectColumn.blocked, true)));
  return row?.id ?? null;
}

// The active issues of the project that an open issue blocks.
export async function openBlockedIssueIds(projectId: number): Promise<number[]> {
  const rows = await db
    .select({ id: issue.id })
    .from(issue)
    .where(and(eq(issue.projectId, projectId), isNull(issue.archivedAt), openBlockerOf(issue.id)));
  return rows.map((r) => r.id);
}

export async function blockedTargetIds(issueIds: number[]): Promise<number[]> {
  if (issueIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ id: issueLink.targetIssueId })
    .from(issueLink)
    .where(and(inArray(issueLink.sourceIssueId, issueIds), eq(issueLink.kind, 'blocks')));
  return rows.map((r) => r.id);
}

// Moves each issue into or out of its project's blocked column to match its blockers.
// Only an issue this function moved in is moved out: it has no reason and a column to
// return to. One a person or an automation put there stays until someone moves it.
// Called after a write that can change whether an issue is blocked: a 'blocks' link
// added or removed, or a blocker that changed column, was archived, restored, moved
// or deleted. Each move is guarded by the column it read, so a person moving the
// issue at the same time wins, and a full column skips the move instead of failing
// the write that started it.
export async function syncBlockedIssues(issueIds: number[], actor?: ActivityActor): Promise<void> {
  if (issueIds.length === 0) return;
  const rows = await db
    .select({
      id: issue.id,
      projectId: issue.projectId,
      columnId: issue.columnId,
      blockedReason: issue.blockedReason,
      blockedFromColumnId: issue.blockedFromColumnId,
      stateType: projectColumn.stateType,
      inBlockedColumn: projectColumn.blocked,
      blocked: sql<boolean>`${openBlockerOf(issue.id)}`,
    })
    .from(issue)
    .innerJoin(projectColumn, eq(projectColumn.id, issue.columnId))
    .where(and(inArray(issue.id, [...new Set(issueIds)]), isNull(issue.archivedAt)));

  for (const row of rows) {
    const opts = { onlyIfColumnId: row.columnId, skipIfColumnFull: true };
    if (row.blocked && !row.inBlockedColumn && BLOCKABLE_STATE_TYPES.includes(row.stateType)) {
      const target = await blockedColumnId(row.projectId);
      if (target !== null) await updateIssue(row.id, { columnId: target }, actor, opts);
    } else if (
      !row.blocked &&
      row.inBlockedColumn &&
      row.blockedReason === null &&
      row.blockedFromColumnId !== null
    ) {
      await updateIssue(row.id, { columnId: row.blockedFromColumnId }, actor, opts);
    }
  }
}
