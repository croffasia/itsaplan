import { useCallback } from 'react';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { BoardIssue, IssuePatch } from '@/lib/api/endpoints/issues';
import { type Maps } from '@/utils/project';
import { useSetFieldValue, useUpdateIssue } from '@/services/issues.service';
import { useIsPhone } from '@/hooks/useIsPhone';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import IssueContextMenu from '@/features/issue/components/actions/IssueContextMenu';
import { DropLine } from '../shared/DropLine';
import { EditableBuiltinCell } from '../shared/EditableBuiltinCell';
import { EditableCustomCell } from '../shared/EditableCustomCell';
import { IssueIdentifier } from '../shared/IssueIdentifier';
import { SubtaskProgress } from '../shared/SubtaskProgress';
import { useIsBlocked } from '../../context/useIssueLinks';
import { useSubtaskFold } from '../../context/useSubtasks';
import { columnKey, type OrderedColumn } from '../../utils/table';
import { TableBuiltinCell } from './TableBuiltinCell';
import { TableRowLinks } from './TableRowLinks';
import { TableRowSubtasks } from './TableRowSubtasks';

// A draggable, droppable table row. Dragging it starts a move; dropping another
// row on it inserts before this one (onDrop). A click (no drag) opens it, except
// on a cell that edits the issue in place.
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
  readOnly,
  onDrop,
  onClick,
  onOpenIssue,
}: {
  project: ProjectDetail;
  issue: BoardIssue;
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
  // In a read-only share, or without work_items edit, the cells only show values.
  readOnly: boolean;
  onDrop: (draggedId: number) => void;
  onClick: () => void;
  // Opens a linked issue from a sub-row.
  onOpenIssue: (id: number) => void;
}) {
  // Drag is disabled on phones, and without work_items edit (reordering is an
  // issue edit).
  const { can } = usePermissions();
  const subtasks = useSubtaskFold();
  const blocked = useIsBlocked(issue);
  const updateIssue = useUpdateIssue(project.project.ref);
  const setFieldValue = useSetFieldValue(project.project.ref);
  const patch = (fields: IssuePatch) => updateIssue.mutate({ id: issue.id, patch: fields });
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
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}
        className={cn(
          'relative grid cursor-grab gap-3 border-b py-2 pr-4 text-sm transition-colors',
          blocked ? 'row-blocked' : 'hover:bg-accent/40',
          alignTop ? 'items-start' : 'items-center',
          indented ? 'pl-9' : 'pl-4',
          isDragging && 'opacity-40',
        )}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {showDropLine && <DropLine className="top-0" />}
        <div className="flex min-w-0 items-center gap-2">
          {showId && (
            <IssueIdentifier
              issue={issue}
              className="text-xs text-muted-foreground tabular-nums"
              onOpenParent={onOpenIssue}
            />
          )}
          <span dir="auto" className="truncate text-foreground">
            {issue.title}
          </span>
          <SubtaskProgress
            issueId={issue.id}
            maps={maps}
            open={subtasks.open}
            onToggle={subtasks.toggle}
          />
        </div>

        {orderedColumns.map((c) =>
          c.kind === 'builtin' ? (
            <EditableBuiltinCell
              key={columnKey(c)}
              column={c.col}
              issue={issue}
              project={project}
              readOnly={readOnly}
              onPatch={patch}
            >
              <TableBuiltinCell column={c.col} issue={issue} maps={maps} />
            </EditableBuiltinCell>
          ) : (
            <EditableCustomCell
              key={columnKey(c)}
              field={c.field}
              issue={issue}
              project={project}
              maps={maps}
              readOnly={readOnly}
              onChange={(value) =>
                setFieldValue.mutate({ issueId: issue.id, fieldId: c.field.id, value })
              }
            />
          ),
        )}

        {subtasks.open && (
          <TableRowSubtasks issueId={issue.id} maps={maps} onOpenIssue={onOpenIssue} />
        )}
        <TableRowLinks links={issue.links} maps={maps} onOpenIssue={onOpenIssue} />
      </div>
    </IssueContextMenu>
  );
}
