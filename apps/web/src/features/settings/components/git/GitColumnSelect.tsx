import { CircleDashed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Column } from '@/lib/api';
import { colorDot } from '@/components/common/fields/colorDot';
import { Pill } from '@/components/common/fields/Pill';
import PopoverPick from '@/components/common/fields/PopoverPick';

// A state select with a null option — the automation target where null means the
// labelled default ("First completed state") or off ("No action").
export default function GitColumnSelect({
  columns,
  value,
  noneLabel,
  readOnly,
  onChange,
}: {
  columns: Column[];
  value: number | null;
  noneLabel: string;
  readOnly?: boolean;
  onChange: (id: number | null) => void;
}) {
  const t = useTranslations('settings.git');
  const column = value == null ? undefined : columns.find((c) => c.id === value);
  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        <Pill active={column != null}>
          {column ? colorDot(column.color) : <CircleDashed />}
          <span className="whitespace-nowrap">{column?.name ?? noneLabel}</span>
        </Pill>
      }
      inputPlaceholder={t('changeState')}
      emptyText={t('noState')}
      items={[
        {
          key: 'none',
          search: noneLabel,
          icon: <CircleDashed />,
          label: noneLabel,
          selected: value == null,
          onSelect: () => onChange(null),
        },
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
