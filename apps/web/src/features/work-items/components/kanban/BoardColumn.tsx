import { useCallback, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronsRightLeft, EyeOff, Pin, PinOff, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ProjectDetail, type BoardIssue } from '@/lib/api';
import { type Maps, type IssueGroup } from '@/utils/project';
import { cn } from '@/lib/utils';
import type { PropertyKey } from '@/utils/viewSettings';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GroupDot } from '../shared/GroupDot';
import { BoardCard } from './BoardCard';
import { CardDropSlot } from './CardDropSlot';
import { DropLine } from '../shared/DropLine';
import { SelectAllToggle } from './SelectAllToggle';
import { useIsOverContainer } from '../../hooks/useIsOverContainer';
import { useIncomingCount } from '../../hooks/useIncomingCount';
import { COLUMN_WIDTH, PINNED_COLUMN } from '../../utils/kanban';
import { wipAllows, wipFullColor, WIP_FULL_TINT, type WipState } from '../../utils/wipLimit';
import { WipCount } from './WipCount';

// The add button sits under the last card, outside the measured cards. It carries
// its own copy of the gap that CardDropSlot puts above a card (pt-2).
const ADD_BUTTON_GAP = 8;
// The height of an outline button (h-9).
const ADD_BUTTON_HEIGHT = 36;

// One flat-board column: a fixed header plus a vertically scrollable, virtualized
// list of its cards. The DOM holds only the cards in the viewport and near it, so
// a column with a large backlog stays fast. Card heights vary, so the virtualizer
// measures each rendered card instead of assuming a fixed size.
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
  pinned,
  onTogglePin,
  wip,
  filtered,
  boardIssues,
  readOnly,
}: {
  project: ProjectDetail;
  group: IssueGroup;
  issues: BoardIssue[];
  maps: Maps;
  properties: PropertyKey[];
  // Whether the view is ordered manually. A card moves within the column only then.
  // With any other sort field, that field decides the order.
  manualOrder: boolean;
  // `index` is where the drop lands in this column's issues. The board turns it
  // into a position for each issue the drag carries.
  onMoveIssue: (issueIds: number[], group: IssueGroup, index: number) => void;
  onOpenIssue: (id: number) => void;
  onAddIssue: () => void;
  onHide: () => void;
  onCollapse: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  // The column's WIP limit. It is null when the column has no limit, and null when
  // the board is not grouped by status. `filtered` says whether the cards shown are
  // only part of the column.
  wip: WipState | null;
  filtered: boolean;
  // Every issue that the board holds. It tells which of a drag's cards are already
  // in this column when only some of them are on screen.
  boardIssues: BoardIssue[];
  readOnly?: boolean;
}) {
  const t = useTranslations('workItems');
  const { can } = usePermissions();
  const canCreateIssue = can('work_items', 'create') && !readOnly;
  const scrollRef = useRef<HTMLDivElement>(null);
  // A column with a full hard limit accepts no card from another column. It is not
  // a drop target during such a drag. Cards already in the column still reorder
  // within it, because that adds no card to the column.
  const incoming = useIncomingCount(group, boardIssues);
  const closed = incoming > 0 && !wipAllows(wip, incoming);
  // The scroll area is the append drop target. Merge its ref with the ref of the
  // virtualizer's scroll element.
  const columnId = `col:${group.key}`;
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: columnId,
    disabled: closed,
    data: { onDrop: (ids: number[]) => onMoveIssue(ids, group, issues.length) },
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
  const cardsHeight = virtualizer.getTotalSize();

  return (
    <div
      className={cn(
        'group/column flex h-full shrink-0 flex-col rounded-md bg-kanban-column px-3 py-2',
        pinned && PINNED_COLUMN,
        wip?.full && WIP_FULL_TINT[wipFullColor(wip)],
      )}
      style={{ width: COLUMN_WIDTH }}
    >
      <div className="mb-2 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <GroupDot group={group} />
          {group.name}
          <WipCount filteredCount={issues.length} wip={wip} filtered={filtered} />
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <>
              <SelectAllToggle ids={issues.map((i) => i.id)} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden size-6 text-muted-foreground md:inline-flex"
                    onClick={onTogglePin}
                    aria-label={pinned ? t('unpin') : t('pin')}
                  >
                    {pinned ? <PinOff /> : <Pin />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{pinned ? t('unpin') : t('pin')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground"
                    onClick={onCollapse}
                    aria-label={t('collapse')}
                  >
                    <ChevronsRightLeft />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('collapse')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground"
                    onClick={onHide}
                    aria-label={t('hide')}
                  >
                    <EyeOff />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('hide')}</TooltipContent>
              </Tooltip>
            </>
          )}
          {canCreateIssue && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground"
                  onClick={onAddIssue}
                  aria-label={t('newIssue')}
                >
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('newIssue')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div
        ref={mergedRef}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto rounded-md',
          isOverColumn && 'bg-kanban-column-raised',
        )}
      >
        <div
          style={{
            height: cardsHeight + (canCreateIssue ? ADD_BUTTON_GAP + ADD_BUTTON_HEIGHT : 0),
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
                <CardDropSlot
                  issueId={issue.id}
                  disabled={!manualOrder || closed}
                  onDrop={(ids) => onMoveIssue(ids, group, vi.index)}
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
              </div>
            );
          })}
          {isOver && manualOrder && issues.length > 0 && (
            <DropLine style={{ top: cardsHeight + 3 }} />
          )}
          {canCreateIssue && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="invisible absolute left-0 w-full text-muted-foreground opacity-0 group-focus-within/column:visible group-focus-within/column:opacity-100 group-hover/column:visible group-hover/column:opacity-100"
                  style={{ top: cardsHeight + ADD_BUTTON_GAP }}
                  onClick={onAddIssue}
                  aria-label={t('newIssue')}
                >
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('newIssue')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
