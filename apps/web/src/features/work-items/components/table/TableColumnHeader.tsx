import { User } from 'lucide-react';
import { columnKey, COLUMN_META, type OrderedColumn } from '../../utils/table';

// The sticky column header row above the virtualized list. It shares the row grid
// template so its labels line up with the cells below.
export function TableColumnHeader({
  columns,
  gridTemplate,
  minWidth,
}: {
  columns: OrderedColumn[];
  gridTemplate: string;
  minWidth: number;
}) {
  return (
    <div
      className="sticky top-0 z-10 grid items-center gap-3 border-b bg-background px-4 py-2 text-xs font-medium text-muted-foreground"
      style={{ gridTemplateColumns: gridTemplate, minWidth }}
    >
      <span>Title</span>
      {columns.map((c) => {
        if (c.kind === 'custom') {
          return (
            <span key={columnKey(c)} className="truncate">
              {c.field.name}
            </span>
          );
        }
        // The assignee column shows avatars, so its header is a right-aligned icon
        // rather than a label.
        if (c.col === 'assignee') {
          return (
            <span key={columnKey(c)} className="flex justify-end">
              <User className="size-3.5" />
            </span>
          );
        }
        return <span key={columnKey(c)}>{COLUMN_META[c.col].label}</span>;
      })}
    </div>
  );
}
