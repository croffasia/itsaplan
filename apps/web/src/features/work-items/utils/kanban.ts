import { type Active } from '@dnd-kit/core';
import { type Issue } from '@/lib/api';
import { preferPrefix } from './dnd';

// What a board drop target does with the dropped issues. A board drag carries
// every selected card when the dragged one is part of the selection, so a target
// always receives a list. Container targets (column, cell) append; card targets
// insert at that card's position.
export interface BoardDropData {
  onDrop: (issueIds: number[]) => void;
}

// The issues a board drag carries, written into the draggable's data by BoardCard.
export function draggedIds(active: Active | null): number[] {
  if (!active) return [];
  const ids = (active.data.current as { issueIds?: number[] } | undefined)?.issueIds;
  return ids ?? [Number(active.id)];
}

// The dragged ids a drop into `target` should actually move, in the order the
// board shows them so several cards keep their relative order. Without manual
// ordering, cards already in the target are left out: the sort field decides
// their order there, so a reorder within it could not hold.
export function issuesToMove(
  issueIds: number[],
  boardOrder: Issue[],
  target: Issue[],
  manualOrder: boolean,
): number[] {
  const ids = manualOrder ? issueIds : issueIds.filter((id) => !target.some((i) => i.id === id));
  const rank = new Map(boardOrder.map((issue, index) => [issue.id, index]));
  return [...ids].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
}

// Width of one board column, shared by the flat board and the swimlane grid so
// the column header row lines up with the cells below it.
export const COLUMN_WIDTH = 348;

// A full column's WIP tint still wins over this background: BoardColumn passes it
// to cn() after this one. Below the mobile breakpoint one column already fills the
// screen, so the pinned one only leads the column order there.
export const PINNED_COLUMN =
  'md:sticky md:start-0 md:z-10 bg-kanban-column-raised shadow-[var(--pinned-column-shadow)]';

export const boardCollision = preferPrefix('card:');

// Collapsed swimlanes are a per-project, per-swimlane-field client-only preference,
// persisted in localStorage so it survives reloads without touching the server.
export function collapsedSwimlanesKey(projectId: number, subgroup: string): string {
  return `kanban-swimlanes-collapsed:${projectId}:${subgroup}`;
}
