import { User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { columnKey, TITLE_COLUMN_KEY, type OrderedColumn } from '../../utils/table';
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
  const t = useTranslations('workItems');
  return (
    <div
      className="sticky top-0 z-10 grid items-center gap-3 border-b bg-background px-4 py-2 text-xs font-medium text-muted-foreground"
      style={{ gridTemplateColumns: gridTemplate, minWidth }}
    >
      <span className="relative flex min-w-0 items-center">
        <span className="truncate">{t('columns.title')}</span>
        <TableColumnResizer
          onResize={(width) => onResize(TITLE_COLUMN_KEY, width)}
          onResizeEnd={onResizeEnd}
        />
      </span>
      {columns.map((c) => {
        // The assignee column shows avatars, so its header is a right-aligned icon
        // rather than a label; the delegate column beside it stays blank.
        const isAssignee = c.kind === 'builtin' && c.col === 'assignee';
        const key = columnKey(c);
        return (
          <span
            key={key}
            className={cn('relative flex min-w-0 items-center', isAssignee && 'justify-end')}
          >
            {c.kind === 'custom' ? (
              <span className="truncate">{c.field.name}</span>
            ) : c.col === 'assignee' ? (
              <User className="size-3.5" />
            ) : c.col === 'delegate' ? (
              <span />
            ) : (
              <span className="truncate">{t(`columns.${c.col}`)}</span>
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
