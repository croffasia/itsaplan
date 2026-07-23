import { useRef } from 'react';
import { DndContext } from '@dnd-kit/core';
import { toast } from 'sonner';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { type Issue } from '@/lib/api';
import {
  buildGroups,
  buildMaps,
  mergeAssign,
  nestIssues,
  positionAt,
  sortIssues,
  type WorkItemsViewProps,
  type IssueGroup,
} from '@/utils/project';
import { usePersistedSet } from '@/hooks/usePersistedSet';
import { useBoardDnd } from '../../hooks/useBoardDnd';
import { useSelection } from '../../context/useSelection';
import { GroupDot } from '../shared/GroupDot';
import { SelectAllToggle } from './SelectAllToggle';
import { CardOverlay } from './CardOverlay';
import { SwimlaneCell } from './SwimlaneCell';
import { boardCollision, COLUMN_WIDTH, collapsedSwimlanesKey } from '../../utils/kanban';
import { sortedOrderMessage } from '../../utils/dnd';

// One flattened swimlane block: its header, then a row of columns.
interface SwimlaneRow {
  swimlane: IssueGroup;
  count: number;
  // Column groups paired with this swimlane's issues for each column, in
  // column display order.
  cells: { column: IssueGroup; issues: Issue[] }[];
}

// Swimlane board: columns split into horizontal swimlanes. The swimlanes are the
// virtualized unit (only the ones near the viewport are in the DOM); within a
// visible swimlane every card renders, since a swimlane's per-column list is
// short. The whole board scrolls both axes together so the columns stay aligned
// with the sticky column header row.
export default function SwimlaneBoard({
  project,
  settings,
  onOpenIssue,
  readOnly,
}: WorkItemsViewProps) {
  const dnd = useBoardDnd(project.project.key, readOnly);
  const selection = useSelection();
  const collapsed = usePersistedSet(collapsedSwimlanesKey(project.project.id, settings.subgroup));

  const maps = buildMaps(project);
  const columnGroups = buildGroups(project, settings.group);
  const swimlaneGroups = buildGroups(project, settings.subgroup);
  const nested = nestIssues(
    swimlaneGroups,
    columnGroups,
    sortIssues(project.issues, settings.sort, project),
    settings.subgroup,
    settings.group,
  );

  // A column is shown unless it is empty across every swimlane and empty columns
  // are hidden; its header count is the project-wide total for that column.
  const columnTotals = new Map(
    columnGroups.map((c) => [
      c.key,
      swimlaneGroups.reduce((n, s) => n + (nested.get(s.key)?.get(c.key)?.length ?? 0), 0),
    ]),
  );
  const columns = settings.showEmptyGroups
    ? columnGroups
    : columnGroups.filter((c) => (columnTotals.get(c.key) ?? 0) > 0);

  // Build one row per swimlane, dropping empty swimlanes when empty groups are
  // hidden.
  const rows: SwimlaneRow[] = [];
  for (const swimlane of swimlaneGroups) {
    const inner = nested.get(swimlane.key)!;
    const count = columns.reduce((n, c) => n + (inner.get(c.key)?.length ?? 0), 0);
    if (!settings.showEmptyGroups && count === 0) continue;
    rows.push({
      swimlane,
      count,
      cells: columns.map((column) => ({ column, issues: inner.get(column.key) ?? [] })),
    });
  }

  // Every visible issue id per column, across swimlanes — the target of a column
  // header's select-all.
  const idsByColumn = new Map<string, number[]>();
  for (const row of rows) {
    for (const cell of row.cells) {
      const list = idsByColumn.get(cell.column.key) ?? [];
      for (const i of cell.issues) list.push(i.id);
      idsByColumn.set(cell.column.key, list);
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 260,
    overscan: 3,
    getItemKey: (index) => rows[index].swimlane.key,
  });

  // Reordering inside a cell only holds when the view is ordered manually: with any
  // other sort field the card would snap back to where the sort puts it. A drop that
  // would reorder is refused and explained; a drop into another cell still goes
  // through, since it changes the grouping fields rather than the order.
  const manualOrder = settings.sort.field === 'manual';

  function moveIssue(
    swimlane: IssueGroup,
    column: IssueGroup,
    cellIssues: Issue[],
    issueId: number,
    position: number,
  ) {
    const assign = mergeAssign(column.assign, swimlane.assign);
    if (!assign) return;
    if (!manualOrder && cellIssues.some((i) => i.id === issueId)) {
      toast.info(sortedOrderMessage(settings.sort.field));
      return;
    }
    dnd.move(issueId, { ...assign, position });
  }

  // Inner width so the sticky header and every swimlane share one horizontal
  // scroll; gap-4 (16px) between columns matches the flat board.
  const innerWidth = columns.length * COLUMN_WIDTH + Math.max(0, columns.length - 1) * 16 + 32;

  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={boardCollision}
      onDragStart={dnd.onDragStart}
      onDragCancel={dnd.onDragCancel}
      onDragEnd={dnd.onDragEnd}
    >
      {/* A click on the board background (not a card or control) clears the
          selection, like Escape. */}
      <div
        ref={scrollRef}
        className="h-full overflow-auto"
        onClick={() => selection.isSelecting && selection.clear()}
      >
        <div style={{ width: innerWidth }}>
          {/* Column header row, sticky so it stays put while swimlanes scroll. */}
          <div
            className="sticky top-0 z-10 flex gap-4 border-b bg-background px-4 py-2"
            onClick={(e) => e.stopPropagation()}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                className="group/column flex items-center gap-2 text-sm font-medium text-foreground"
                style={{ width: COLUMN_WIDTH }}
              >
                <GroupDot group={column} />
                <span className="truncate">{column.name}</span>
                <span className="text-muted-foreground">{columnTotals.get(column.key) ?? 0}</span>
                {!readOnly && (
                  <SelectAllToggle ids={idsByColumn.get(column.key) ?? []} className="ml-auto" />
                )}
              </div>
            ))}
          </div>

          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index];
              const isCollapsed = collapsed.values.has(row.swimlane.key);
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      collapsed.toggle(row.swimlane.key);
                    }}
                    className="flex w-full items-center gap-2 bg-muted/30 px-4 py-1.5 text-sm font-medium text-foreground"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    )}
                    <GroupDot group={row.swimlane} />
                    {row.swimlane.name}
                    <span className="text-muted-foreground">{row.count}</span>
                  </button>

                  {!isCollapsed && (
                    <div className="flex gap-4 px-4 pt-2 pb-4">
                      {row.cells.map(({ column, issues }) => (
                        <SwimlaneCell
                          key={column.key}
                          project={project}
                          issues={issues}
                          maps={maps}
                          properties={settings.properties}
                          cellKey={`${row.swimlane.key}|${column.key}`}
                          manualOrder={manualOrder}
                          readOnly={readOnly}
                          onOpenIssue={onOpenIssue}
                          onMoveIssue={(issueId, index) =>
                            moveIssue(
                              row.swimlane,
                              column,
                              issues,
                              issueId,
                              positionAt(issues, index),
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <CardOverlay
        activeId={dnd.activeId}
        issues={project.issues}
        maps={maps}
        properties={settings.properties}
      />
    </DndContext>
  );
}
