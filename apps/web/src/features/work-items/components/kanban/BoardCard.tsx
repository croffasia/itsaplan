import { memo, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { DRAG_ACTIVATION_DISTANCE } from '@/lib/dnd';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import { type Maps } from '@/utils/project';
import { useIsPhone } from '@/hooks/useIsPhone';
import { cn } from '@/lib/utils';
import type { PropertyKey } from '@/utils/viewSettings';
import IssueContextMenu from '@/features/issue/components/actions/IssueContextMenu';
import { useIsBlocked } from '../../context/useIssueLinks';
import { useSelection } from '../../context/useSelection';
import { draggedIds } from '../../utils/kanban';
import { IssueCardBody } from './IssueCardBody';

// A draggable board card. Dragging it starts a move; the drop target that inserts
// before it is its wrapping CardDropSlot. Dragging a selected card moves the whole
// selection, so the drag carries those ids. A plain click opens it, but with a
// selection active (or a Shift/Cmd-click) the click toggles the card's selection
// instead — the board's multi-select for bulk actions.
// Memoized because a column renders again on every scroll step.
export const BoardCard = memo(function BoardCard({
  project,
  issue,
  maps,
  properties,
  onOpen,
  canEdit,
  readOnly,
}: {
  project: ProjectDetail;
  issue: BoardIssue;
  maps: Maps;
  properties: PropertyKey[];
  onOpen: (id: number) => void;
  // Passed in rather than read with usePermissions: that reads the Shell context,
  // which changes on every Shell render, and the card would render with it.
  canEdit: boolean;
  // In a read-only share a click always opens the issue; multi-select is off.
  readOnly?: boolean;
}) {
  const selection = useSelection();
  const selected = selection.isSelected(issue.id);
  const blocked = useIsBlocked(issue);
  // `active` comes from useDraggable, not useDndContext: the dnd-kit context changes
  // each time a scrolled column mounts a card, and every card reading it renders again.
  const { setNodeRef, attributes, listeners, active } = useDraggable({
    id: issue.id,
    data: { issueIds: selected ? [...selection.selected] : [issue.id] },
    // Drag is disabled on phones, and without work_items edit (moving a card is an
    // issue edit).
    disabled: useIsPhone() || !canEdit,
  });
  // Every card that moves with the drag dims, not just the grabbed one.
  const isDragging = draggedIds(active).includes(issue.id);

  // The browser still fires a click after a drag ends, which would open the issue
  // the moment it is dropped. Remember where the press started and ignore a click
  // that moved further than the drag activation distance.
  const pressedAt = useRef<{ x: number; y: number } | null>(null);
  const isClick = (e: { clientX: number; clientY: number }) => {
    const start = pressedAt.current;
    pressedAt.current = null;
    return (
      !start || Math.hypot(e.clientX - start.x, e.clientY - start.y) <= DRAG_ACTIVATION_DISTANCE
    );
  };

  return (
    <IssueContextMenu project={project} issue={issue}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onPointerDown={(e) => {
          pressedAt.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={(e) => {
          // Both stopPropagation calls keep the click off the board background,
          // which would clear the selection — the one the drag has just moved, or
          // the one this click is changing.
          if (!isClick(e)) {
            e.stopPropagation();
            return;
          }
          if (!readOnly && (selection.isSelecting || e.shiftKey || e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            e.stopPropagation();
            selection.toggle(issue.id);
          } else {
            // Opening an issue handles the click, so the detail panel keeps it
            // rather than reading it as a click outside and closing.
            e.preventDefault();
            onOpen(issue.id);
          }
        }}
        className={cn(
          // select-none so a Shift/Cmd-click toggles selection without the browser
          // also starting a native text selection across cards.
          'kanban-card cursor-grab rounded-md p-2 select-none',
          isDragging && 'opacity-40',
          blocked && 'kanban-card-blocked',
          // Selected cards read as a primary-tinted fill, like Linear — no border,
          // no checkbox (see .kanban-card-selected in globals.css).
          selected && 'kanban-card-selected',
        )}
      >
        <IssueCardBody issue={issue} maps={maps} properties={properties} onOpen={onOpen} />
      </div>
    </IssueContextMenu>
  );
});
