import { CircleDashed } from 'lucide-react';
import type { Column } from '@/lib/api';
import { colorDot } from './colorDot';
import { Pill } from './Pill';
import PopoverPick from './PopoverPick';
import { useTranslations } from 'next-intl';

export default function StatusSelect({
  columns,
  value,
  onChange,
  readOnly,
}: {
  columns: Column[];
  value: number;
  onChange: (id: number) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.fieldSelects');
  const column = columns.find((c) => c.id === value);
  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        <Pill active>
          {column ? colorDot(column.color) : <CircleDashed />}
          <span className="truncate">{column?.name ?? t('state')}</span>
        </Pill>
      }
      inputPlaceholder={t('changeState')}
      emptyText={t('noState')}
      items={columns.map((c) => ({
        key: String(c.id),
        search: c.name,
        icon: colorDot(c.color),
        label: c.name,
        selected: c.id === value,
        onSelect: () => onChange(c.id),
      }))}
    />
  );
}
