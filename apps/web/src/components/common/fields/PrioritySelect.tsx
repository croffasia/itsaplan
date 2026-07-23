import { Pill } from './Pill';
import { PRIORITY_FIELDS } from './priorityFields';
import PopoverPick from './PopoverPick';

// Value is the priority string, '' for none (matches PRIORITY_FIELDS[0]).
export default function PrioritySelect({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const prio = PRIORITY_FIELDS.find((p) => p.value === value) ?? PRIORITY_FIELDS[0];
  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        <Pill active={!!value}>
          {prio.icon}
          {value ? prio.label : 'Priority'}
        </Pill>
      }
      inputPlaceholder="Set priority to…"
      items={PRIORITY_FIELDS.map((p) => ({
        key: p.value || 'none',
        search: p.label,
        icon: p.icon,
        label: p.label,
        selected: p.value === value,
        onSelect: () => onChange(p.value),
      }))}
    />
  );
}
