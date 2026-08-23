import { db, issue, projectColumn } from '@repo/db';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getSubtaskAutomationSettings } from '#modules/projects/service';
import { listSubtasks } from './subtasks';
import { updateIssue, type IssueRow } from './service';
import type { ActivityActor } from './activity';

// The subtask automations a column change triggers, both off unless the project
// turns them on (modules/projects/service.ts). A closed issue is one sitting in a
// column whose stateType is 'completed' or 'canceled'.
//
// The hierarchy is one level deep, so an issue is either a subtask or a parent and
// only one of the two rules applies to it. Each rule writes through updateIssue, so
// the moved issues get their own activity entries and webhooks — and re-enter this
// function. That does not loop: a rule skips an issue already in the target column,
// which is where the nested pass finds every issue it would move.

const CLOSED_STATE_TYPES = ['completed', 'canceled'];

export async function applySubtaskAutomation(
  after: IssueRow,
  actorUserId?: ActivityActor,
): Promise<void> {
  const settings = await getSubtaskAutomationSettings(after.projectId);
  if (!settings.completeParent && !settings.closeSubtasks) return;
  if (!(await isClosedColumn(after.columnId))) return;

  if (after.parentId !== null) {
    if (settings.completeParent) await completeParent(after.parentId, after, actorUserId);
    return;
  }
  if (settings.closeSubtasks) await closeSubtasks(after, actorUserId);
}

// Moves the issue's parent into the column the issue was just closed in, once every
// other subtask is closed too. Archived subtasks are off the board and do not hold
// the parent open; an archived parent is left where it is rather than brought back.
// A parent already closed keeps its own column: the rule has nothing left to do.
async function completeParent(
  parentId: number,
  subtask: IssueRow,
  actorUserId?: ActivityActor,
): Promise<void> {
  const siblingColumnIds = (await listSubtasks(parentId))
    .filter((s) => !s.archived && s.id !== subtask.id)
    .map((s) => s.columnId);
  const parentColumnId = await activeColumn(parentId);
  if (parentColumnId === null) return;
  const closed = await closedColumnIds([...siblingColumnIds, parentColumnId]);
  if (closed.has(parentColumnId)) return;
  if (siblingColumnIds.some((id) => !closed.has(id))) return;
  await updateIssue(parentId, { columnId: subtask.columnId }, actorUserId, {
    skipIfColumnFull: true,
  });
}

// Moves the issue's still-open subtasks into the column it was just closed in.
async function closeSubtasks(parent: IssueRow, actorUserId?: ActivityActor): Promise<void> {
  const subtasks = (await listSubtasks(parent.id)).filter((s) => !s.archived);
  const closed = await closedColumnIds(subtasks.map((s) => s.columnId));
  for (const subtask of subtasks)
    if (!closed.has(subtask.columnId))
      await updateIssue(subtask.id, { columnId: parent.columnId }, actorUserId, {
        skipIfColumnFull: true,
      });
}

async function isClosedColumn(columnId: number): Promise<boolean> {
  return (await closedColumnIds([columnId])).has(columnId);
}

// The subset of the given column ids whose stateType counts as closed.
async function closedColumnIds(columnIds: number[]): Promise<Set<number>> {
  const ids = [...new Set(columnIds)];
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: projectColumn.id })
    .from(projectColumn)
    .where(
      and(inArray(projectColumn.id, ids), inArray(projectColumn.stateType, CLOSED_STATE_TYPES)),
    );
  return new Set(rows.map((r) => r.id));
}

// The issue's column, or null when it is gone or archived.
async function activeColumn(issueId: number): Promise<number | null> {
  const [row] = await db
    .select({ columnId: issue.columnId })
    .from(issue)
    .where(and(eq(issue.id, issueId), isNull(issue.archivedAt)));
  return row?.columnId ?? null;
}
