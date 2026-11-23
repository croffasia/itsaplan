import { CircleDashed, Plus } from 'lucide-react';
import { colorDot } from '@/components/common/fields/colorDot';
import { Pill } from '@/components/common/fields/Pill';
import PopoverPick from '@/components/common/fields/PopoverPick';

interface Target {
  id: number;
  name: string;
  color: string;
}

// A project label or issue type a repository label becomes, or none. When no option
// has the repository label's name, the list offers to create one with that name.
export default function GitMappingTargetSelect({
  options,
  value,
  externalName,
  text,
  onChange,
  onCreate,
}: {
  options: Target[];
  value: number | null;
  externalName: string;
  text: { none: string; placeholder: string; empty: string; create: string };
  onChange: (id: number | null) => void;
  onCreate: () => void;
}) {
  const selected = value == null ? undefined : options.find((option) => option.id === value);
  const exists = options.some((option) => option.name.toLowerCase() === externalName.toLowerCase());
  return (
    <PopoverPick
      trigger={
        <Pill active={selected != null}>
          {selected ? colorDot(selected.color) : <CircleDashed />}
          <span className="whitespace-nowrap">{selected?.name ?? text.none}</span>
        </Pill>
      }
      inputPlaceholder={text.placeholder}
      emptyText={text.empty}
      items={[
        {
          key: 'none',
          search: text.none,
          icon: <CircleDashed />,
          label: text.none,
          selected: value == null,
          onSelect: () => onChange(null),
        },
        ...options.map((option) => ({
          key: String(option.id),
          search: option.name,
          icon: colorDot(option.color),
          label: option.name,
          selected: option.id === value,
          onSelect: () => onChange(option.id),
        })),
        ...(exists
          ? []
          : [
              {
                key: 'create',
                search: text.create,
                icon: <Plus />,
                label: text.create,
                selected: false,
                onSelect: onCreate,
              },
            ]),
      ]}
    />
  );
}
