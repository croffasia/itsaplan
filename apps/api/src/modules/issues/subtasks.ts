import { ancestorIds, db, issue, project as projectTable, subtreeIds } from '@repo/db';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { HttpError } from '#shared/lib';
import { archiveIssue, assertTreeLink, deleteIssue, restoreIssue, updateIssue } from './service';
import type { AttachmentRow } from '#modules/attachments/service';

// An issue's subtasks: issues carrying its id in parent_id. A subtask can have
// subtasks of its own, down to MAX_SUBTASK_DEPTH levels (see assertParent in
// service.ts).

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

function refRowsWhere(condition: SQL) {
  return db
    .select({
      id: issue.id,
      sequenceNumber: issue.sequenceNumber,
      projectKey: projectTable.key,
      title: issue.title,
      columnId: issue.columnId,
      typeId: issue.typeId,
      archivedAt: issue.archivedAt,
      parentId: issue.parentId,
    })
    .from(issue)
    .innerJoin(projectTable, eq(projectTable.id, issue.projectId))
    .where(condition)
    .orderBy(issue.sequenceNumber);
}

function toRef(row: Awaited<ReturnType<typeof refRowsWhere>>[number]): IssueRef {
  return {
    id: row.id,
    sequenceNumber: row.sequenceNumber,
    identifier: `${row.projectKey}-${row.sequenceNumber}`,
    title: row.title,
    columnId: row.columnId,
    typeId: row.typeId,
    archived: row.archivedAt !== null,
  };
}

async function refsWhere(condition: SQL): Promise<IssueRef[]> {
  return (await refRowsWhere(condition)).map(toRef);
}

// The issue's subtasks, by issue number. Archived ones are included: they stay
// attached to their parent and are restored as its subtasks.
export async function listSubtasks(issueId: number): Promise<IssueRef[]> {
  return refsWhere(eq(issue.parentId, issueId));
}

// The subtasks a delete, an archive or a restore acts on: the ones in the issue's
// project. A subtask an old import left in another project is not touched.
function subtasksInProject(projectId: number, issueId: number): Promise<IssueRef[]> {
  return refsWhere(and(eq(issue.parentId, issueId), eq(issue.projectId, projectId))!);
}

// The issues above the issue, from the one on level 1 down to its parent.
export async function listAncestors(issueId: number): Promise<IssueRef[]> {
  const ids = await ancestorIds(issueId);
  if (ids.length === 0) return [];
  const refs = await refsWhere(inArray(issue.id, ids));
  return ids.flatMap((id) => refs.find((ref) => ref.id === id) ?? []);
}

// Every issue of the project under the given ones, archived ones included, each with
// the issue it hangs under: what a cascading delete or archive removes, and what a
// move takes along. One of the given issues that sits under another is listed too.
export async function listSubtree(
  projectId: number,
  issueIds: number[],
): Promise<(IssueRef & { parentId: number })[]> {
  if (issueIds.length === 0) return [];
  const children = await db
    .select({ id: issue.id })
    .from(issue)
    .where(and(inArray(issue.parentId, issueIds), eq(issue.projectId, projectId)));
  const ids = await subtreeIds(children.map((row) => row.id));
  if (ids.length === 0) return [];
  const rows = await refRowsWhere(and(inArray(issue.id, ids), eq(issue.projectId, projectId))!);
  return rows.flatMap((row) =>
    row.parentId === null ? [] : [{ ...toRef(row), parentId: row.parentId }],
  );
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

// Brings back the archived subtasks of a restored issue, and theirs under them, so
// a restore is the reverse of the cascading archive that took them with it. A
// subtask archived on its own comes back too — the two are not told apart. An
// active subtask is left as it is, together with everything under it.
export async function restoreSubtasksOf(
  projectId: number,
  issueId: number,
  actorUserId?: string | null,
): Promise<void> {
  for (const subtask of await subtasksInProject(projectId, issueId)) {
    if (!subtask.archived) continue;
    await restoreIssue(subtask.id, actorUserId);
    await restoreSubtasksOf(projectId, subtask.id, actorUserId);
  }
}

// What happens to an issue's subtasks when it is deleted or archived: they follow
// it with everything under them ('cascade' — deleted with a delete, archived with
// an archive), they are detached and become ordinary issues, or they move to
// another parent. A detached or moved subtask keeps its own subtasks.
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
  // Resolved once, against the whole request, so a target the subtasks cannot move
  // to is rejected before anything is written.
  const newParentId =
    disposition.mode === 'reassign'
      ? await reassignTarget(projectId, disposition, issueIds, parents)
      : null;
  const attachments: AttachmentRow[] = [];
  for (const parentId of parents)
    attachments.push(
      ...(await disposeSubtasks(
        projectId,
        parentId,
        action,
        disposition.mode,
        newParentId,
        actorUserId,
      )),
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
    .where(
      and(
        inArray(issue.parentId, ids),
        eq(parent.projectId, projectId),
        eq(issue.projectId, projectId),
      ),
    );
  return rows.flatMap((row) => (row.parentId === null ? [] : [row.parentId]));
}

// Applies the choice to one issue's subtasks. Runs one subtask at a time so each
// gets the activity entries and webhooks its own update/delete/archive writes.
async function disposeSubtasks(
  projectId: number,
  issueId: number,
  action: 'delete' | 'archive',
  mode: SubtaskMode,
  newParentId: number | null,
  actorUserId?: string | null,
): Promise<AttachmentRow[]> {
  if (mode === 'cascade')
    return cascade(projectId, issueId, action, new Set([issueId]), actorUserId);

  // 'detach' clears the parent, 'reassign' points it at newParentId. The rules
  // that link has to hold (same project, no cycle, the depth limit) are enforced
  // by the update itself, which rejects the whole request on the first failure.
  for (const subtask of await subtasksInProject(projectId, issueId))
    await updateIssue(subtask.id, { parentId: newParentId }, actorUserId);
  return [];
}

// Deletes or archives every level under the issue, each subtask after the ones under
// it. `seen` ends the walk on a parent cycle left in old data.
async function cascade(
  projectId: number,
  issueId: number,
  action: 'delete' | 'archive',
  seen: Set<number>,
  actorUserId?: string | null,
): Promise<AttachmentRow[]> {
  const attachments: AttachmentRow[] = [];
  for (const subtask of await subtasksInProject(projectId, issueId)) {
    if (seen.has(subtask.id)) continue;
    seen.add(subtask.id);
    attachments.push(...(await cascade(projectId, subtask.id, action, seen, actorUserId)));
    if (action === 'delete')
      attachments.push(...((await deleteIssue(subtask.id, actorUserId)) ?? []));
    else await archiveIssue(subtask.id, actorUserId);
  }
  return attachments;
}

// The issue reassigned subtasks move to. Rejects a missing parent, one in another
// project, and a parent this same request removes or one under it — which would
// delete the subtasks with it, leave them under an archived issue, or put a subtask
// under itself. Each subtask is checked against the tree rules here as well: the
// per-subtask update checks them too, but only after the subtasks before it have
// already moved.
async function reassignTarget(
  projectId: number,
  disposition: SubtaskDisposition,
  removedIds: number[],
  parentIds: number[],
): Promise<number> {
  const { newParentId } = disposition;
  if (newParentId === undefined) throw new HttpError(400, 'A new parent is required to reassign');
  // Checked first: the walks below would otherwise answer questions about the
  // hierarchy of another project's issues.
  const [target] = await db
    .select({ projectId: issue.projectId })
    .from(issue)
    .where(eq(issue.id, newParentId));
  if (target?.projectId !== projectId)
    throw new HttpError(400, 'Parent must belong to this project');
  if ((await subtreeIds(removedIds)).includes(newParentId))
    throw new HttpError(
      400,
      'Subtasks cannot be reassigned to an issue being removed or to one under it',
    );
  for (const parentId of parentIds)
    for (const subtask of await subtasksInProject(projectId, parentId))
      await assertTreeLink(subtask.id, newParentId);
  return newParentId;
}
