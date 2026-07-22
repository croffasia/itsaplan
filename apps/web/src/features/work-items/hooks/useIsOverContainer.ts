import { useDndContext } from '@dnd-kit/core';
import { type Issue } from '@/lib/api';

// Whether a drag is over a card container (a board column or a swimlane cell).
// Collision detection prefers a card over its container, so the container's own
// `isOver` goes false the moment the pointer crosses a card and its highlight
// would flicker while dragging over it. The container counts as hovered whenever
// the pointer is on it or on any of its cards.
export function useIsOverContainer(containerId: string, issues: Issue[]): boolean {
  const { over } = useDndContext();
  if (!over) return false;
  const overId = String(over.id);
  return overId === containerId || issues.some((issue) => overId === `card:${issue.id}`);
}
