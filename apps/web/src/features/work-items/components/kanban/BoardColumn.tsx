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

// The add button sits under the last card, outside the measured cards, so it
// carries its own copy of the gap CardDropSlot puts above a card (pt-2).
const ADD_BUTTON_GAP = 8;
// The h-9 of an outline button.
const ADD_BUTTON_HEIGHT = 36;

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
  // Whether the view is ordered manually. Cards can only be reordered within the
  // column then; otherwise the sort field decides their order.
  manualOrder: boolean;
  // `index` is where in this column's issues the drop lands; the board turns it
  // into positions for however many issues the drag carries.
  onMoveIssue: (issueIds: number[], group: IssueGroup, index: number) => void;
  onOpenIssue: (id: number) => void;
  onAddIssue: () => void;
  onHide: () => void;
  onCollapse: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  // The column's WIP limit, or null when it has none or this board is not grouped
  // by status. `filtered` says whether the cards shown are a subset of the column.
  wip: WipState | null;
  filtered: boolean;
  // Every issue the board holds, to tell which of a drag's cards are already in
  // this column when only some of them are on screen.
  boardIssues: BoardIssue[];
  // In a read-only share the add affordance and select-all toggle are hidden.
  readOnly?: boolean;
}) {
  const t = useTranslations('workItems');
  const { can } = usePermissions();
  const canCreateIssue = can('work_items', 'create') && !readOnly;
  const scrollRef = useRef<HTMLDivElement>(null);
  // A hard limit that is already full takes no card from elsewhere, so the column
  // stops being a drop target while such a drag is in flight. Cards already in it
  // still reorder within it — that adds nothing to the column.
  const incoming = useIncomingCount(group, boardIssues);
  const closed = incoming > 0 && !wipAllows(wip, incoming);
  // The scroll area is the append drop target; merge its ref with the virtualizer
  // scroll element ref.
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
      {/* Stop header clicks (select-all, pin, collapse, hide, add) from reaching the
          board background, which clears the selection. */}
      <div className="mb-2 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <GroupDot group={group} />
          {group.name}
          <WipCount filteredCount={issues.length} wip={wip} filtered={filtered} />
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && <SelectAllToggle ids={issues.map((i) => i.id)} />}
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
                {/* The slot carries the gap above the card and the virtualizer
                    measures it, so the gap belongs to the card below it — where a
                    drop in that gap inserts. */}
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
          {/* Hovering the empty area below the cards appends, so the marker sits
              under the last one. */}
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
