import { useTranslations } from 'next-intl';
import { byKey } from '@/utils/messageKey';
import { type OrderedColumn } from '../utils/table';

// `workItems.columns` has no assignee or delegate, so those two take their
// Display panel names.
export function useColumnLabel() {
  const t = useTranslations('workItems');
  const property = byKey(useTranslations('display.properties'));
  return (column: OrderedColumn): string => {
    if (column.kind === 'custom') return column.field.name;
    if (column.col === 'assignee' || column.col === 'delegate') return property(column.col);
    return t(`columns.${column.col}`);
  };
}
