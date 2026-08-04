import { arrayMove } from '@dnd-kit/sortable';

// The bounds the API validates against, mirrored so the inputs stop an over-long
// value before it becomes a rejected request.
export const CHECKLIST_TITLE_MAX = 200;
export const CHECKLIST_ITEM_MAX = 500;

// The id order a drag produces: the dragged row moved to where the row it was
// dropped on sits. Returns null when the drag changes nothing, so the caller can
// skip the write.
export function reorderIds(
  rows: { id: number }[],
  draggedId: number,
  targetId: number,
): number[] | null {
  const ids = rows.map((row) => row.id);
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1 || from === to) return null;
  return arrayMove(ids, from, to);
}

// How many of an issue's checklist items are checked off, across all of its
// checklists — the tally on the section heading.
export function checklistProgress(checklists: { items: { done: boolean }[] }[]): {
  done: number;
  total: number;
} {
  const items = checklists.flatMap((checklist) => checklist.items);
  return { done: items.filter((item) => item.done).length, total: items.length };
}
