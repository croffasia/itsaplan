import type { ReactNode } from 'react';
import { useDndContext, useDroppable } from '@dnd-kit/core';
import { DropLine } from '../shared/DropLine';
import { draggedIds } from '../../utils/kanban';

// The drop target for inserting before one card. It wraps the card together with
// the gap above it, so a pointer in that gap still targets this card instead of
// falling through to the column (which would read as "append to the end"). The
// insertion marker is drawn in that gap.
//
// Disabled when the view is not ordered manually: the card order comes from the
// sort field then, so a drop between two cards cannot hold. The column stays a
// drop target, so a card can still move to another column.
export function CardDropSlot({
  issueId,
  onDrop,
  disabled = false,
  children,
}: {
  issueId: number;
  onDrop: (issueIds: number[]) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `card:${issueId}`,
    disabled,
    data: { onDrop: (ids: number[]) => !ids.includes(issueId) && onDrop(ids) },
  });
  // Dropping cards on one of themselves is a no-op, so it gets no marker.
  const { active } = useDndContext();
  const showDropLine = isOver && !draggedIds(active).includes(issueId);

  return (
    <div ref={setNodeRef} className="relative pt-2">
      {showDropLine && <DropLine className="top-[3px]" />}
      {children}
    </div>
  );
}
