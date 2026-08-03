import type { BoardIssue, Column, SubtaskDisposition } from '@/lib/api';

// A subtask choice the API can act on: 'reassign' also needs the issue to move to.
// The delete and archive confirmations stay disabled until it is.
export function dispositionReady(disposition: SubtaskDisposition | null): boolean {
  if (!disposition) return false;
  return disposition.subtasks !== 'reassign' || disposition.newParentId != null;
}

// The issues a layout renders rows of its own for: a subtask is dropped, since it
// is rendered under its parent instead. One whose parent is not in the set keeps
// its own row — the parent is archived or filtered out, so there is nothing to
// render it under and it would otherwise disappear.
export function withoutShownSubtasks<T extends { id: number; parentId: number | null }>(
  issues: T[],
): T[] {
  const shown = new Set(issues.map((issue) => issue.id));
  return issues.filter((issue) => issue.parentId === null || !shown.has(issue.parentId));
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
