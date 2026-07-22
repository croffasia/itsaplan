import { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { DRAG_ACTIVATION_DISTANCE } from '@/lib/dnd';
import { type ProjectDetail, type Issue } from '@/lib/api';
import { type Maps } from '@/utils/project';
import { useIsPhone } from '@/hooks/useIsPhone';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import type { PropertyKey } from '@/utils/viewSettings';
import IssueContextMenu from '@/features/issue/components/actions/IssueContextMenu';
import { useSelection } from '../../context/useSelection';
import { IssueCardBody } from './IssueCardBody';

// A draggable board card. Dragging it starts a move; the drop target that inserts
// before it is its wrapping CardDropSlot. A plain click opens it, but with a
// selection active (or a Shift/Cmd-click) the click toggles the card's selection
// instead — the board's multi-select for bulk actions.
export function BoardCard({
  project,
  issue,
  maps,
  properties,
  onOpen,
}: {
  project: ProjectDetail;
  issue: Issue;
  maps: Maps;
  properties: PropertyKey[];
  onOpen: (id: number) => void;
}) {
  // Drag is disabled on phones so a touch scrolls the board instead of picking
  // up a card (see the `sm:touch-none` on the card below), and without work_items
  // edit (moving a card is an issue edit).
  const { can } = usePermissions();
  const selection = useSelection();
  const selected = selection.isSelected(issue.id);
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: issue.id,
    disabled: useIsPhone() || !can('work_items', 'edit'),
  });

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
          listeners?.onPointerDown?.(e);
        }}
        onClick={(e) => {
          if (!isClick(e)) return;
          if (selection.isSelecting || e.shiftKey || e.metaKey || e.ctrlKey) {
            e.preventDefault();
            // Don't let the click reach the board background, which clears the
            // selection.
            e.stopPropagation();
            selection.toggle(issue.id);
          } else {
            onOpen(issue.id);
          }
        }}
        className={cn(
          // select-none so a Shift/Cmd-click toggles selection without the browser
          // also starting a native text selection across cards.
          'kanban-card cursor-grab rounded-md p-3 select-none sm:touch-none',
          isDragging && 'opacity-40',
          // Selected cards read as a primary-tinted fill, like Linear — no border,
          // no checkbox (see .kanban-card-selected in globals.css).
          selected && 'kanban-card-selected',
        )}
      >
        <IssueCardBody issue={issue} maps={maps} properties={properties} />
      </div>
    </IssueContextMenu>
  );
}
