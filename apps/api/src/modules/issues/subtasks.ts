import { db, issue, project as projectTable } from '@repo/db';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { HttpError } from '#shared/lib';
import { archiveIssue, deleteIssue, restoreIssue, updateIssue } from './service';
import type { AttachmentRow } from '#modules/attachments/service';

// An issue's subtasks: issues carrying its id in parent_id. The hierarchy is one
// level deep (see assertParent in service.ts), so a subtask has no subtasks of its
// own and every issue is either a parent, a subtask, or neither.

// A subtask or a parent as the issue page renders it: enough to name the issue and
// show its state, without its description or field values.
export interface IssueRef {
  id: number;
  sequenceNumber: number;
  identifier: string;
  title: string;
  columnId: number;
  typeId: number | null;
  archived: boolean;
}

async function refsWhere(condition: SQL): Promise<IssueRef[]> {
  const rows = await db
    .select({
      id: issue.id,
      sequenceNumber: issue.sequenceNumber,
      projectKey: projectTable.key,
      title: issue.title,
      columnId: issue.columnId,
      typeId: issue.typeId,
      archivedAt: issue.archivedAt,
    })
    .from(issue)
    .innerJoin(projectTable, eq(projectTable.id, issue.projectId))
    .where(condition)
    .orderBy(issue.sequenceNumber);
  return rows.map((row) => ({
    id: row.id,
    sequenceNumber: row.sequenceNumber,
    identifier: `${row.projectKey}-${row.sequenceNumber}`,
    title: row.title,
    columnId: row.columnId,
    typeId: row.typeId,
    archived: row.archivedAt !== null,
  }));
}

// The issue's subtasks, by issue number. Archived ones are included: they stay
// attached to their parent and are restored as its subtasks.
export async function listSubtasks(issueId: number): Promise<IssueRef[]> {
  return refsWhere(eq(issue.parentId, issueId));
}

// The issue an issue is a subtask of, or null when it has none.
export async function getParentRef(parentId: number | null): Promise<IssueRef | null> {
  if (parentId === null) return null;
  return (await refsWhere(eq(issue.id, parentId)))[0] ?? null;
}

// Puts each of the board's issues together with how many subtasks it has, archived
// ones included. The board itself lists only active issues, so it cannot count them
// from its own payload — and it has to know about the archived ones too, since they
// are what a delete or an archive asks about.
export async function attachSubtaskCounts<T extends { id: number }>(
  issues: T[],
  projectId: number,
): Promise<(T & { subtaskCount: number })[]> {
  const parent = alias(issue, 'parent_issue');
  const rows = await db
    .select({ parentId: issue.parentId, count: sql<number>`count(*)::int` })
    .from(issue)
    .innerJoin(parent, eq(parent.id, issue.parentId))
    .where(eq(parent.projectId, projectId))
    .groupBy(issue.parentId);
  const byParent = new Map(rows.map((row) => [row.parentId, row.count]));
  return issues.map((row) => ({ ...row, subtaskCount: byParent.get(row.id) ?? 0 }));
}

// Brings back the archived subtasks of a restored issue, so a restore is the
// reverse of the cascading archive that took them with it. A subtask archived on
// its own comes back too — the two are not told apart.
export async function restoreSubtasksOf(
  issueId: number,
  actorUserId?: string | null,
): Promise<void> {
  for (const subtask of await listSubtasks(issueId))
    if (subtask.archived) await restoreIssue(subtask.id, actorUserId);
}

// What happens to an issue's subtasks when it is deleted or archived: they follow
// it ('cascade' — deleted with a delete, archived with an archive), they are
// detached and become ordinary issues, or they move to another parent.
export type SubtaskMode = 'cascade' | 'detach' | 'reassign';

export interface SubtaskDisposition {
  mode: SubtaskMode;
  // The issue the subtasks move to. Required by 'reassign', ignored otherwise.
  newParentId?: number;
}

// Applies the caller's choice to the subtasks of every issue about to be deleted or
// archived. An issue with no subtasks needs no choice; one that has them and was
// given none is rejected with a 409, so nothing is removed until the caller says
// what happens to its subtasks. Returns the attachment rows of the subtasks a
// cascading delete removed, for the caller to purge from the object store.
//
// projectId is the project the request is authorised for: an id outside it is
// ignored, so a bulk call cannot reach the subtasks of another project's issues.
export async function disposeSubtasksOf(
  projectId: number,
  issueIds: number[],
  action: 'delete' | 'archive',
  disposition: SubtaskDisposition | undefined,
  actorUserId?: string | null,
): Promise<AttachmentRow[]> {
  const parents = await issuesWithSubtasks(projectId, issueIds);
  if (parents.length === 0) return [];
  if (!disposition)
    throw new HttpError(409, 'Choose what happens to the subtasks: cascade, detach or reassign');
  // Resolved once, against the whole request: a target that is itself being
  // removed is rejected before anything is written.
  const newParentId =
    disposition.mode === 'reassign' ? reassignTarget(disposition, issueIds) : null;
  const attachments: AttachmentRow[] = [];
  for (const parentId of parents)
    attachments.push(
      ...(await disposeSubtasks(parentId, action, disposition.mode, newParentId, actorUserId)),
    );
  return attachments;
}

// The ids of the project's issues that have subtasks, out of the given set.
async function issuesWithSubtasks(projectId: number, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const parent = alias(issue, 'parent_issue');
  const rows = await db
    .selectDistinct({ parentId: issue.parentId })
    .from(issue)
    .innerJoin(parent, eq(parent.id, issue.parentId))
    .where(and(inArray(issue.parentId, ids), eq(parent.projectId, projectId)));
  return rows.flatMap((row) => (row.parentId === null ? [] : [row.parentId]));
}

// Applies the choice to one issue's subtasks. Runs one subtask at a time so each
// gets the activity entries and webhooks its own update/delete/archive writes.
async function disposeSubtasks(
  issueId: number,
  action: 'delete' | 'archive',
  mode: SubtaskMode,
  newParentId: number | null,
  actorUserId?: string | null,
): Promise<AttachmentRow[]> {
  const subtasks = await listSubtasks(issueId);

  if (mode === 'cascade') {
    const attachments: AttachmentRow[] = [];
    for (const subtask of subtasks) {
      if (action === 'delete') attachments.push(...((await deleteIssue(subtask.id)) ?? []));
      else await archiveIssue(subtask.id, actorUserId);
    }
    return attachments;
  }

  // 'detach' clears the parent, 'reassign' points it at newParentId. The rules
  // that link has to hold (same project, no subtask as a parent) are enforced by
  // the update itself, which rejects the whole request on the first failure.
  for (const subtask of subtasks)
    await updateIssue(subtask.id, { parentId: newParentId }, actorUserId);
  return [];
}

// The issue reassigned subtasks move to, rejecting the two cases the per-subtask
// update cannot see: no parent given, and a parent this same request removes —
// which would delete the subtasks with it, or leave them under an archived issue.
function reassignTarget(disposition: SubtaskDisposition, removedIds: number[]): number {
  const { newParentId } = disposition;
  if (newParentId === undefined) throw new HttpError(400, 'A new parent is required to reassign');
  if (removedIds.includes(newParentId))
    throw new HttpError(400, 'Subtasks cannot be reassigned to an issue being removed');
  return newParentId;
}
