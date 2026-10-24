import { useTranslations } from 'next-intl';
import { byKey } from '@/utils/messageKey';
import { columnKey, type OrderedColumn } from '../../utils/table';
import { type TimelineColumn } from '../../utils/timeline';

// The labels over the label column: the title and each property column, level with
// the day numbers and as wide as the cells below them. Unlike the Table header, a
// person column is named, since its cells name the person.
export function TimelineColumnHeader({ columns }: { columns: TimelineColumn[] }) {
  const t = useTranslations('workItems');
  const property = byKey(useTranslations('display.properties'));
  const labelOf = (column: OrderedColumn): string => {
    if (column.kind === 'custom') return column.field.name;
    if (column.col === 'assignee' || column.col === 'delegate') return property(column.col);
    return t(`columns.${column.col}`);
  };

  return (
    <div className="flex h-full items-end text-xs font-medium text-muted-foreground">
      <div className="flex h-6 min-w-0 flex-1 items-center px-3">
        <span className="truncate">{t('columns.title')}</span>
      </div>
      {columns.map(({ column, width }) => (
        <div
          key={columnKey(column)}
          className="flex h-6 shrink-0 items-center overflow-hidden px-1.5"
          style={{ width }}
        >
          <span className="truncate">{labelOf(column)}</span>
        </div>
      ))}
    </div>
  );
}
