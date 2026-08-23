import { type Column, type WipMode } from '@/lib/api';
import { type IssueGroup } from '@/utils/project';

// A column's work-in-progress limit as the board reads it.
//
// `count` is the column's real occupancy, not the number of cards on screen: a
// limit belongs to the state, so measuring it against a filtered view would make
// the same column look full to one viewer and empty to another. `full` is at *or
// past* the limit, since a column can already be over one that was lowered under it.
export interface WipState {
  count: number;
  limit: number;
  mode: WipMode;
  full: boolean;
}

// The limit of the column a board group stands for, or null when the group is not
// a column (the board also groups by assignee, priority, cycle…) or that column
// has no limit set.
export function wipStateFor(
  group: IssueGroup,
  columns: Column[],
  counts: Map<number, number>,
): WipState | null {
  const columnId = group.assign?.patch.columnId;
  if (columnId == null) return null;
  const column = columns.find((c) => c.id === columnId);
  if (!column || column.wipLimit == null) return null;

  const count = counts.get(columnId) ?? 0;
  return {
    count,
    limit: column.wipLimit,
    mode: column.wipMode,
    full: count >= column.wipLimit,
  };
}

export type WipFullColor = 'destructive' | 'warning';

// The colour a full column is marked in, by what its limit does: a hard limit has
// refused work, a soft one only warns.
export function wipFullColor(state: WipState): WipFullColor {
  return state.mode === 'hard' ? 'destructive' : 'warning';
}

// Tailwind matches class names as literal strings, so the two variants are spelled
// out rather than built from the colour name.
export const WIP_FULL_TEXT: Record<WipFullColor, string> = {
  destructive: 'text-destructive',
  warning: 'text-warning',
};

// Opaque, not a translucent tint: a pinned column is sticky, and the columns
// scrolling behind it would show through.
export const WIP_FULL_TINT: Record<WipFullColor, string> = {
  destructive: 'bg-kanban-column-wip-destructive',
  warning: 'bg-kanban-column-wip-warning',
};

// Whether `incoming` more issues may enter the column. Only a hard limit refuses;
// a soft one is advisory, and a column with no limit is always open.
export function wipAllows(state: WipState | null, incoming: number): boolean {
  if (!state || state.mode !== 'hard') return true;
  return state.count + incoming <= state.limit;
}

// How many of the moved issues are not already in the column the group stands for
// — the ones that would actually add to its occupancy. Reordering a card within
// its column, or moving it between two swimlanes of the same column, adds none.
//
// `issues` is what the board is showing, so an id it does not know is one the
// active filters hide. Those count as entering: the alternative is to assume they
// are already in the column and let a move through that the API would refuse.
export function countEntering(
  movedIds: number[],
  issues: { id: number; columnId: number }[],
  group: IssueGroup,
): number {
  const columnId = group.assign?.patch.columnId;
  if (columnId == null) return movedIds.length;
  const byId = new Map(issues.map((issue) => [issue.id, issue.columnId]));
  return movedIds.filter((id) => byId.get(id) !== columnId).length;
}

// Issues per column across the whole project, ignoring the active filters.
// Archived issues are never in the payload, so they are already out of the count,
// which matches how the API counts a column.
export function countIssuesByColumn(issues: { columnId: number }[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const issue of issues) counts.set(issue.columnId, (counts.get(issue.columnId) ?? 0) + 1);
  return counts;
}
