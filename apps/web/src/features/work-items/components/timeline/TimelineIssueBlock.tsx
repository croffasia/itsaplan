import { useDndContext, useDroppable } from '@dnd-kit/core';
import { DropLine } from '../shared/DropLine';
import { SubtaskFoldProvider, useSubtaskFold } from '../../context/useSubtasks';

// An issue's rows on the timeline — its own row plus the subtask and link
// sub-rows under it — as one drop target: a drop anywhere on the block inserts
// the dragged issue before this one, so the sub-rows are not a gap the drop falls
// through.
export function TimelineIssueBlock({
  issueId,
  disabled,
  onDrop,
  children,
}: {
  issueId: number;
  // Dropping between rows only holds under manual ordering. With any other sort
  // the block stops being a drop target so the pointer falls through to the
  // section header, which refuses the move and explains why.
  disabled: boolean;
  onDrop: (draggedId: number) => void;
  children: React.ReactNode;
}) {
  // Dropping an issue on itself is a no-op: it neither moves nor gets a marker.
  const { active } = useDndContext();
  const self = Number(active?.id) === issueId;
  const { setNodeRef, isOver } = useDroppable({
    id: `row:${issueId}`,
    disabled,
    data: { onDrop: (draggedId: number) => draggedId !== issueId && onDrop(draggedId) },
  });
  // The subtask fold belongs to the block rather than to either row: the chevron is
  // on the issue row and the rows it folds are its siblings.
  const fold = useSubtaskFold();
  // The insertion marker sits at the block's top edge: a drop inserts before it.
  return (
    <div ref={setNodeRef} className="relative">
      {isOver && !self && <DropLine className="top-0 z-20" />}
      <SubtaskFoldProvider value={fold}>{children}</SubtaskFoldProvider>
    </div>
  );
}
