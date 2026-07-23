import { useDroppable } from '@dnd-kit/core';
import { type ProjectDetail, type Issue } from '@/lib/api';
import { type Maps } from '@/utils/project';
import { cn } from '@/lib/utils';
import type { PropertyKey } from '@/utils/viewSettings';
import { BoardCard } from './BoardCard';
import { CardDropSlot } from './CardDropSlot';
import { DropLine } from '../shared/DropLine';
import { useIsOverContainer } from '../../hooks/useIsOverContainer';
import { COLUMN_WIDTH } from '../../utils/kanban';

// One swimlane+column cell: a fixed-width, non-virtualized stack of cards that is
// a drop target. Empty cells still render so a drag can drop into them.
export function SwimlaneCell({
  project,
  issues,
  maps,
  properties,
  cellKey,
  manualOrder,
  readOnly,
  onOpenIssue,
  onMoveIssue,
}: {
  project: ProjectDetail;
  issues: Issue[];
  maps: Maps;
  properties: PropertyKey[];
  cellKey: string;
  // Whether the view is ordered manually. Cards can only be reordered within the
  // cell then; otherwise the sort field decides their order.
  manualOrder: boolean;
  // In a read-only share a card click always opens the issue; multi-select is off.
  readOnly?: boolean;
  onOpenIssue: (id: number) => void;
  onMoveIssue: (issueId: number, index: number) => void;
}) {
  // Dropping on the empty cell area appends; dropping on a card inserts at it.
  const cellId = `col:${cellKey}`;
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { onDrop: (id: number) => onMoveIssue(id, issues.length) },
  });
  const isOverCell = useIsOverContainer(cellId, issues);
  return (
    <div
      ref={setNodeRef}
      className={cn('min-h-16 shrink-0 rounded-md pb-2', isOverCell && 'bg-accent/40')}
      style={{ width: COLUMN_WIDTH }}
    >
      <div className="relative flex flex-col">
        {/* Each slot carries the gap above its card, so a drop in that gap inserts
            before it instead of falling through to the cell. */}
        {issues.map((issue, index) => (
          <CardDropSlot
            key={issue.id}
            issueId={issue.id}
            disabled={!manualOrder}
            onDrop={(draggedId) => onMoveIssue(draggedId, index)}
          >
            <BoardCard
              project={project}
              issue={issue}
              maps={maps}
              properties={properties}
              onOpen={onOpenIssue}
              readOnly={readOnly}
            />
          </CardDropSlot>
        ))}
        {/* Hovering the empty area below the cards appends, so the marker sits
            under the last one. */}
        {isOver && manualOrder && issues.length > 0 && <DropLine className="-bottom-[5px]" />}
      </div>
    </div>
  );
}
