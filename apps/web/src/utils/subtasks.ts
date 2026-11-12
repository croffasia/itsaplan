import type { Column } from '@/lib/api/endpoints/columns';
import type { BoardIssue, SubtaskDisposition } from '@/lib/api/endpoints/issues';

// The deepest level a subtask can sit on; an issue there cannot have subtasks.
// Mirrors MAX_SUBTASK_DEPTH in @repo/db, which the API enforces.
export const MAX_SUBTASK_DEPTH = 8;

// A subtask choice the API can act on: 'reassign' also needs the issue to move to.
// The delete and archive confirmations stay disabled until it is.
export function dispositionReady(disposition: SubtaskDisposition | null): boolean {
  if (!disposition) return false;
  return disposition.subtasks !== 'reassign' || disposition.newParentId != null;
}

// The issues a layout renders rows of its own for: a subtask is dropped, since it
// is rendered under its parent instead. Under a parent that is itself a subtask it
// is only counted on that parent's row, and opening the parent lists it. One whose
// parent is not in the set keeps its own row — the parent is archived or filtered
// out, so there is nothing to render it under and it would otherwise disappear.
export function withoutShownSubtasks<T extends { id: number; parentId: number | null }>(
  issues: T[],
): T[] {
  const shown = new Set(issues.map((issue) => issue.id));
  return issues.filter((issue) => issue.parentId === null || !shown.has(issue.parentId));
}

// The issues under the given roots in tree order, each with how deep it sits: 0 for
// a direct subtask of a root. A root that is itself under another root is listed
// there.
export function subtreeRows<T extends { id: number; parentId: number }>(
  issues: T[],
  rootIds: number[],
): { issue: T; depth: number }[] {
  const children = new Map<number, T[]>();
  for (const issue of issues)
    children.set(issue.parentId, [...(children.get(issue.parentId) ?? []), issue]);
  const listed = new Set(issues.map((issue) => issue.id));
  const rows: { issue: T; depth: number }[] = [];
  const walk = (parentId: number, depth: number) => {
    for (const issue of children.get(parentId) ?? []) {
      rows.push({ issue, depth });
      walk(issue.id, depth + 1);
    }
  };
  for (const id of rootIds) if (!listed.has(id)) walk(id, 0);
  return rows;
}

// How many issues a delete or an archive takes: the selected ones, and every level
// under them when the subtasks follow (cascade).
export function removalCount(
  ids: number[],
  subtree: { id: number }[],
  disposition: SubtaskDisposition | null,
): number {
  if (disposition?.subtasks !== 'cascade') return ids.length;
  return new Set([...ids, ...subtree.map((issue) => issue.id)]).size;
}

// How many subtasks the given issues have, read off the board payload. The delete
// and archive confirmations ask what happens to them whenever this is not zero —
// the API rejects a removal that does not say.
export function subtaskCount(issues: BoardIssue[], parentIds: number[]): number {
  const wanted = new Set(parentIds);
  return issues.reduce(
    (total, issue) => (wanted.has(issue.id) ? total + issue.subtaskCount : total),
    0,
  );
}

// How far an issue's subtasks have got: the ones in a completed column against
// how many there are. Canceled subtasks count towards neither — they were dropped,
// not finished, and counting them as done would read as progress.
export function subtaskProgress(
  subtasks: { columnId: number }[],
  columnById: Map<number, Column>,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const subtask of subtasks) {
    const stateType = columnById.get(subtask.columnId)?.stateType;
    if (stateType === 'canceled') continue;
    total++;
    if (stateType === 'completed') done++;
  }
  return { done, total };
}
