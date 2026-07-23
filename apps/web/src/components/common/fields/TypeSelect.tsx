import { CircleDashed } from 'lucide-react';
import type { IssueType } from '@/lib/api';
import { colorDot } from './colorDot';
import { Pill } from './Pill';
import PopoverPick from './PopoverPick';

export default function TypeSelect({
  issueTypes,
  value,
  onChange,
  readOnly,
}: {
  issueTypes: IssueType[];
  value: number | null;
  onChange: (id: number | null) => void;
  readOnly?: boolean;
}) {
  const type = issueTypes.find((t) => t.id === value);
  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        <Pill active={!!type}>
          {type ? colorDot(type.color) : <CircleDashed />}
          {type?.name ?? 'Type'}
        </Pill>
      }
      inputPlaceholder="Change type…"
      items={[
        {
          key: 'none',
          search: 'No type',
          icon: <CircleDashed />,
          label: 'No type',
          selected: value == null,
          onSelect: () => onChange(null),
        },
        ...issueTypes.map((t) => ({
          key: String(t.id),
          search: t.name,
          icon: colorDot(t.color),
          label: t.name,
          selected: t.id === value,
          onSelect: () => onChange(t.id),
        })),
      ]}
    />
  );
}
