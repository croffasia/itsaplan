import { useRef, type ReactNode, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { GROUP_H, ROW_H, SUBGROUP_H, type TimelineRow } from '../../utils/timeline';
import { TimelineRowSlot } from './TimelineRowSlot';

const ROW_HEIGHT: Record<TimelineRow['kind'], number> = {
  group: GROUP_H,
  subgroup: SUBGROUP_H,
  issue: ROW_H,
};

function rowKey(row: TimelineRow): string {
  if (row.kind === 'group') return `g-${row.group.key}`;
  if (row.kind === 'subgroup') return `s-${row.groupKey}`;
  return `i-${row.issue.id}`;
}

// Only the rows in and near the viewport are rendered: a project with thousands of
// issues otherwise renders every row on each change. An issue's block grows with its
// subtask and link rows, so each rendered row is measured.
export function TimelineRows({
  rows,
  scrollRef,
  renderRow,
}: {
  rows: TimelineRow[];
  scrollRef: RefObject<HTMLDivElement | null>;
  renderRow: (row: TimelineRow) => ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => ROW_HEIGHT[rows[index].kind],
    overscan: 10,
    // A scroll step renders in a normal React update, not in flushSync inside the
    // scroll event, which blocks every scroll event on a slow CPU.
    useFlushSync: false,
    getItemKey: (index) => rowKey(rows[index]),
    // The rows start below the sticky header.
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });
  const scrollMargin = virtualizer.options.scrollMargin;

  return (
    <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((vi) => (
        <div
          key={vi.key}
          data-index={vi.index}
          ref={virtualizer.measureElement}
          className="absolute top-0 left-0 w-full"
          style={{ transform: `translateY(${vi.start - scrollMargin}px)` }}
        >
          <TimelineRowSlot row={rows[vi.index]} renderRow={renderRow} />
        </div>
      ))}
    </div>
  );
}
