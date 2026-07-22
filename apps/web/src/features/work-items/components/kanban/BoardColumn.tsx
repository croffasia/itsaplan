import { useCallback, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronsRightLeft, EyeOff, Plus } from 'lucide-react';
import { type ProjectDetail, type Issue } from '@/lib/api';
import { type Maps, positionAt, type IssueGroup } from '@/utils/project';
import { cn } from '@/lib/utils';
import type { PropertyKey } from '@/utils/viewSettings';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { GroupDot } from '../shared/GroupDot';
import { BoardCard } from './BoardCard';
import { CardDropSlot } from './CardDropSlot';
import { DropLine } from '../shared/DropLine';
import { SelectAllToggle } from './SelectAllToggle';
import { useIsOverContainer } from '../../hooks/useIsOverContainer';
import { COLUMN_WIDTH } from '../../utils/kanban';

// One flat-board column: a fixed header plus a vertically scrollable, virtualized
// list of its cards. Only the cards in (and near) the viewport are in the DOM, so
// a column with a large backlog stays fast. Card heights vary, so the virtualizer
// measures each rendered card rather than assuming a fixed size.
export function BoardColumn({
  project,
  group,
  issues,
  maps,
  properties,
  manualOrder,
  onMoveIssue,
  onOpenIssue,
  onAddIssue,
  onHide,
  onCollapse,
}: {
  project: ProjectDetail;
  group: IssueGroup;
  issues: Issue[];
  maps: Maps;
  properties: PropertyKey[];
  // Whether the view is ordered manually. Cards can only be reordered within the
  // column then; otherwise the sort field decides their order.
  manualOrder: boolean;
  onMoveIssue: (issueId: number, group: IssueGroup, position: number) => void;
  onOpenIssue: (id: number) => void;
  onAddIssue: () => void;
  onHide: () => void;
  onCollapse: () => void;
}) {
  const { can } = usePermissions();
  const canCreateIssue = can('work_items', 'create');
  const scrollRef = useRef<HTMLDivElement>(null);
  // The scroll area is the append drop target; merge its ref with the virtualizer
  // scroll element ref.
  const columnId = `col:${group.key}`;
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: columnId,
    data: { onDrop: (id: number) => onMoveIssue(id, group, positionAt(issues, issues.length)) },
  });
  const mergedRef = useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el;
      dropRef(el);
    },
    [dropRef],
  );
  const isOverColumn = useIsOverContainer(columnId, issues);

  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 130,
    overscan: 8,
    getItemKey: (index) => issues[index].id,
  });

  return (
    <div
      className="group/column flex h-full shrink-0 flex-col rounded-md"
      style={{ width: COLUMN_WIDTH }}
    >
      {/* Stop header clicks (select-all, collapse, hide, add) from reaching the
          board background, which clears the selection. */}
      <div
        className="mb-2 flex items-center justify-between px-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <GroupDot group={group} />
          {group.name}
          <span className="text-muted-foreground">{issues.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <SelectAllToggle ids={issues.map((i) => i.id)} />
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground"
            onClick={onCollapse}
            title="Collapse"
          >
            <ChevronsRightLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground"
            onClick={onHide}
            title="Hide"
          >
            <EyeOff />
          </Button>
          {canCreateIssue && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              onClick={onAddIssue}
              title="New issue"
            >
              <Plus />
            </Button>
          )}
        </div>
      </div>

      <div
        ref={mergedRef}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto rounded-md px-1 pb-2',
          isOverColumn && 'bg-accent/40',
        )}
      >
        <div
          style={{
            height: virtualizer.getTotalSize() + (canCreateIssue ? 36 : 0),
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualizer.getVirtualItems().map((vi) => {
            const issue = issues[vi.index];
            return (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                {/* The slot carries the gap above the card and the virtualizer
                    measures it, so the gap belongs to the card below it — where a
                    drop in that gap inserts. */}
                <CardDropSlot
                  issueId={issue.id}
                  disabled={!manualOrder}
                  onDrop={(draggedId) =>
                    onMoveIssue(draggedId, group, positionAt(issues, vi.index))
                  }
                >
                  <BoardCard
                    project={project}
                    issue={issue}
                    maps={maps}
                    properties={properties}
                    onOpen={onOpenIssue}
                  />
                </CardDropSlot>
              </div>
            );
          })}
          {/* Hovering the empty area below the cards appends, so the marker sits
              under the last one. */}
          {isOver && manualOrder && issues.length > 0 && (
            <DropLine style={{ top: virtualizer.getTotalSize() + 3 }} />
          )}
          {canCreateIssue && (
            <Button
              variant="outline"
              className="invisible absolute left-0 w-full text-muted-foreground opacity-0 group-focus-within/column:visible group-focus-within/column:opacity-100 group-hover/column:visible group-hover/column:opacity-100"
              style={{ top: virtualizer.getTotalSize() }}
              onClick={onAddIssue}
              title="New issue"
            >
              <Plus />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
