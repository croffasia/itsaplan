import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { columnKey, COLUMN_META, TITLE_COLUMN_KEY, type OrderedColumn } from '../../utils/table';
import { TableColumnResizer } from './TableColumnResizer';

// The sticky column header row above the virtualized list. It shares the row grid
// template so its labels line up with the cells below, and carries the resize
// grips: each cell holds the one for its own column. The label is truncated by an
// inner span, so the grip is not clipped by the cell's overflow.
export function TableColumnHeader({
  columns,
  gridTemplate,
  minWidth,
  onResize,
  onResizeEnd,
}: {
  columns: OrderedColumn[];
  gridTemplate: string;
  minWidth: number;
  onResize: (columnKey: string, width: number) => void;
  onResizeEnd: () => void;
}) {
  return (
    <div
      className="sticky top-0 z-10 grid items-center gap-3 border-b bg-background px-4 py-2 text-xs font-medium text-muted-foreground"
      style={{ gridTemplateColumns: gridTemplate, minWidth }}
    >
      <span className="relative flex min-w-0 items-center">
        <span className="truncate">Title</span>
        <TableColumnResizer
          onResize={(width) => onResize(TITLE_COLUMN_KEY, width)}
          onResizeEnd={onResizeEnd}
        />
      </span>
      {columns.map((c) => {
        // The assignee column shows avatars, so its header is a right-aligned icon
        // rather than a label.
        const isAssignee = c.kind === 'builtin' && c.col === 'assignee';
        const key = columnKey(c);
        return (
          <span
            key={key}
            className={cn('relative flex min-w-0 items-center', isAssignee && 'justify-end')}
          >
            {isAssignee ? (
              <User className="size-3.5" />
            ) : (
              <span className="truncate">
                {c.kind === 'custom' ? c.field.name : COLUMN_META[c.col].label}
              </span>
            )}
            <TableColumnResizer
              onResize={(width) => onResize(key, width)}
              onResizeEnd={onResizeEnd}
            />
          </span>
        );
      })}
    </div>
  );
}
