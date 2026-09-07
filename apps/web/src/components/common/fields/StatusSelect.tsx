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
  onClear,
  readOnly,
}: {
  columns: Column[];
  // Null only where nothing is picked yet: an issue always has a state, a template
  // that presets none does not.
  value: number | null;
  onChange: (id: number) => void;
  // When set, the list offers a "no state" choice. Every issue has a state, so
  // only a caller that presets one (an issue template) can clear it.
  onClear?: () => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.fieldSelects');
  const column = columns.find((c) => c.id === value);
  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        <Pill active={column != null}>
          {column ? colorDot(column.color) : <CircleDashed />}
          <span className="truncate">{column?.name ?? t('state')}</span>
        </Pill>
      }
      inputPlaceholder={t('changeState')}
      emptyText={t('noState')}
      items={[
        ...(onClear
          ? [
              {
                key: 'none',
                search: t('unsetState'),
                icon: <CircleDashed />,
                label: t('unsetState'),
                selected: column == null,
                onSelect: onClear,
              },
            ]
          : []),
        ...columns.map((c) => ({
          key: String(c.id),
          search: c.name,
          icon: colorDot(c.color),
          label: c.name,
          selected: c.id === value,
          onSelect: () => onChange(c.id),
        })),
      ]}
    />
  );
}
