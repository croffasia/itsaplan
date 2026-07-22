import { useCallback } from 'react';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { type ProjectDetail, type Issue } from '@/lib/api';
import { type Maps } from '@/utils/project';
import { useIsPhone } from '@/hooks/useIsPhone';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import IssueContextMenu from '@/features/issue/components/actions/IssueContextMenu';
import { DropLine } from '../shared/DropLine';
import { columnKey, type OrderedColumn } from '../../utils/table';
import { TableBuiltinCell } from './TableBuiltinCell';
import { TableCustomCell } from './TableCustomCell';

// A draggable, droppable table row. Dragging it starts a move; dropping another
// row on it inserts before this one (onDrop). A click (no drag) opens it.
export function TableRow({
  project,
  issue,
  orderedColumns,
  maps,
  showId,
  indented,
  alignTop,
  gridTemplate,
  dropDisabled,
  onDrop,
  onClick,
}: {
  project: ProjectDetail;
  issue: Issue;
  orderedColumns: OrderedColumn[];
  maps: Maps;
  showId: boolean;
  // Rows under a sub-section are indented to sit below their sub-header.
  indented: boolean;
  // Top-align cells (a tall markdown cell is present) instead of centering.
  alignTop: boolean;
  gridTemplate: string;
  // Dropping between rows only holds under manual ordering. With any other sort
  // the row stops being a drop target so the pointer falls through to the section
  // header, which refuses the move and explains why.
  dropDisabled: boolean;
  onDrop: (draggedId: number) => void;
  onClick: () => void;
}) {
  // Drag is disabled on phones so a touch scrolls the list instead of picking up
  // a row (see the `sm:touch-none` below), and without work_items edit (reordering
  // is an issue edit).
  const { can } = usePermissions();
  const {
    setNodeRef: dragRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({ id: issue.id, disabled: useIsPhone() || !can('work_items', 'edit') });
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `row:${issue.id}`,
    disabled: dropDisabled,
    data: { onDrop: (draggedId: number) => draggedId !== issue.id && onDrop(draggedId) },
  });
  // The insertion marker sits at this row's top edge: a drop inserts before it.
  // Dropping a row on itself is a no-op, so it gets no marker.
  const { active } = useDndContext();
  const showDropLine = isOver && Number(active?.id) !== issue.id;
  const mergedRef = useCallback(
    (el: HTMLElement | null) => {
      dragRef(el);
      dropRef(el);
    },
    [dragRef, dropRef],
  );
  return (
    <IssueContextMenu project={project} issue={issue}>
      <div
        ref={mergedRef}
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={cn(
          'relative grid cursor-grab gap-3 border-b py-2 pr-4 text-sm transition-colors hover:bg-accent/40 sm:touch-none',
          alignTop ? 'items-start' : 'items-center',
          indented ? 'pl-9' : 'pl-4',
          isDragging && 'opacity-40',
        )}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {showDropLine && <DropLine className="top-0" />}
        <div className="flex min-w-0 items-center gap-2">
          {showId && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {issue.identifier}
            </span>
          )}
          <span className="truncate text-foreground">{issue.title}</span>
        </div>

        {orderedColumns.map((c) =>
          c.kind === 'builtin' ? (
            <TableBuiltinCell key={columnKey(c)} column={c.col} issue={issue} maps={maps} />
          ) : (
            <TableCustomCell key={columnKey(c)} field={c.field} issue={issue} />
          ),
        )}
      </div>
    </IssueContextMenu>
  );
}
