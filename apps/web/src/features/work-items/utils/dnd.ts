import { pointerWithin, type CollisionDetection } from '@dnd-kit/core';
import { SORT_FIELDS, type SortField } from '@/utils/viewTypes';

// Data a drop target carries: the move to apply when an issue is dropped on it,
// given the dragged issue id. Container targets (column, cell, section) append;
// item targets (card, row) insert at that item's position.
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
