import { CircleDashed } from 'lucide-react';
import type { Column } from '@/lib/api';
import { colorDot } from './colorDot';
import { Pill } from './Pill';
import PopoverPick from './PopoverPick';

export default function StatusSelect({
  columns,
  value,
  onChange,
}: {
  columns: Column[];
  value: number;
  onChange: (id: number) => void;
}) {
  const column = columns.find((c) => c.id === value);
  return (
    <PopoverPick
      trigger={
        <Pill active>
          {column ? colorDot(column.color) : <CircleDashed />}
          {column?.name ?? 'State'}
        </Pill>
      }
      inputPlaceholder="Change state…"
      emptyText="No state."
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
