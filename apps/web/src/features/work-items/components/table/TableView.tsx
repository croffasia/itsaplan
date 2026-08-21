import { useRef } from 'react';
import { DndContext } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  buildGroups,
  buildMaps,
  groupDefaults,
  sortIssues,
  type WorkItemsViewProps,
} from '@/utils/project';
import { usePersistedSet } from '@/hooks/usePersistedSet';
import { useTableColumnWidths } from '../../hooks/useTableColumnWidths';
import { useIssueReorder } from '../../hooks/useIssueReorder';
import { useGroupLabels } from '@/hooks/useGroupLabels';
import {
  buildTableItems,
  collapsedKey,
  columnWidthsKey,
  resolveColumns,
  type FlatItem,
} from '../../utils/table';
import { IssueDragOverlay } from '../shared/IssueDragOverlay';
import { TableColumnHeader } from './TableColumnHeader';
import { TableSectionHeader } from './TableSectionHeader';
import { TableSubHeader } from './TableSubHeader';
import { TableRow } from './TableRow';

interface TableViewProps extends WorkItemsViewProps {
  // Which stored set of column widths this table uses: a saved view's own, the
  // All tab's, or the single set every cycle / initiative board shares.
  widthScope: string;
}

export default function TableView({
  project,
  filters,
  customFields,
  settings,
  onOpenIssue,
  onAddIssue,
  readOnly,
  widthScope,
}: TableViewProps) {
  const groupLabels = useGroupLabels();
  const reorder = useIssueReorder({ project, sort: settings.sort, readOnly });
  const collapsed = usePersistedSet(
    collapsedKey(project.project.id, settings.group, settings.subgroup),
  );
  const { widths, setWidth, persistWidths } = useTableColumnWidths(
    columnWidthsKey(project.project.key, widthScope),
  );

  const grouped = settings.group !== 'none';
  const subgrouped = grouped && settings.subgroup !== 'none';
  const sorted = sortIssues(project.issues, settings.sort, project);
  const groups = buildGroups(project, settings.group, groupLabels, filters);
  const subGroups = subgrouped ? buildGroups(project, settings.subgroup, groupLabels, filters) : [];
  const maps = buildMaps(project);

  const { columns, gridTemplate, minWidth, alignTop } = resolveColumns(
    settings.properties,
    customFields,
    widths,
  );

  const items = buildTableItems({
    groups,
    subGroups,
    sorted,
    settings,
    collapsed: collapsed.values,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 12,
    getItemKey: (index) => {
      const it = items[index];
      if (it.kind === 'header') return `h${it.group.key}`;
      if (it.kind === 'subheader') return `s${it.dropKey}`;
      return `r${it.issue.id}`;
    },
  });

  function renderItem(item: FlatItem) {
    switch (item.kind) {
      case 'header': {
        // When sub-grouped, issues live under the sub-headers, so the group header
        // is only a drop target while the group is collapsed and they are hidden.
        const isCollapsed = collapsed.values.has(item.group.key);
        return (
          <TableSectionHeader
            group={item.group}
            count={item.count}
            collapsed={isCollapsed}
            disabled={subgrouped && !isCollapsed}
            dropId={`sec:${item.dropKey}`}
            onDrop={(id) => reorder.moveIssue(id, item.assign, item.bucket, item.bucket.length)}
            onToggle={() => collapsed.toggle(item.group.key)}
            onAddIssue={() => onAddIssue(groupDefaults(item.group.assign))}
            readOnly={readOnly}
          />
        );
      }
      case 'subheader':
        return (
          <TableSubHeader
            sub={item.sub}
            count={item.count}
            collapsed={collapsed.values.has(item.dropKey)}
            dropId={`sec:${item.dropKey}`}
            onDrop={(id) => reorder.moveIssue(id, item.assign, item.bucket, item.bucket.length)}
            onToggle={() => collapsed.toggle(item.dropKey)}
          />
        );
      case 'row':
        return (
          <TableRow
            project={project}
            issue={item.issue}
            orderedColumns={columns}
            maps={maps}
            showId={settings.properties.includes('id')}
            alignTop={alignTop}
            indented={subgrouped}
            gridTemplate={gridTemplate}
            dropDisabled={!reorder.manualOrder && grouped}
            onDrop={(draggedId) =>
              reorder.moveIssue(draggedId, item.assign, item.bucket, item.index)
            }
            onClick={() => onOpenIssue(item.issue.id)}
            onOpenIssue={onOpenIssue}
          />
        );
    }
  }

  return (
    <DndContext
      sensors={reorder.sensors}
      collisionDetection={reorder.collisionDetection}
      onDragStart={reorder.onDragStart}
      onDragCancel={reorder.onDragCancel}
      onDragEnd={reorder.onDragEnd}
    >
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <TableColumnHeader
          columns={columns}
          gridTemplate={gridTemplate}
          minWidth={minWidth}
          onResize={setWidth}
          onResizeEnd={persistWidths}
        />

        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
            minWidth,
          }}
        >
          {virtualizer.getVirtualItems().map((vi) => (
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
              {renderItem(items[vi.index])}
            </div>
          ))}
        </div>
      </div>

      <IssueDragOverlay issue={reorder.activeIssue} />
    </DndContext>
  );
}
