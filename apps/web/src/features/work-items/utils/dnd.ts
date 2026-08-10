import { pointerWithin, type CollisionDetection } from '@dnd-kit/core';
import { SORT_FIELDS, type SortField } from '@/utils/viewTypes';

// Data a table drop target carries: the move to apply when an issue is dropped on
// it, given the dragged issue id. Section targets append; row targets insert at
// that row's position. The board's equivalent is BoardDropData, which carries a
// list because a board drag can move a whole selection.
export interface DropData {
  onDrop: (issueId: number) => void;
}

// Why an issue cannot be reordered inside its group: the view is sorted by a
// field, so the order is not the user's to set until ordering is back on Manual.
export function sortedOrderMessage(field: SortField): string {
  const label = SORT_FIELDS.find((f) => f.value === field)?.label ?? field;
  return `Issues are ordered by ${label}. Switch ordering to Manual to move them.`;
}

// Item drop targets sit inside their container target, so the pointer is always
// over both. Prefer the item so hovering one inserts at it, while hovering the
// empty container area falls through to the container (append).
export function preferPrefix(prefix: string): CollisionDetection {
  return (args) => {
    const hits = pointerWithin(args);
    const item = hits.find((h) => String(h.id).startsWith(prefix));
    return item ? [item] : hits;
  };
}
