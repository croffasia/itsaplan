import type { Label, LabelGroup } from '@/lib/api';
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { colorDot } from './colorDot';
import LabelPickerItem from './LabelPickerItem';

// One section of the label picker: ungrouped labels render as top-level items, a
// group renders as a submenu.
export default function LabelPickerSection({
  group,
  labels,
  selected,
  onToggle,
}: {
  group: LabelGroup | null;
  labels: Label[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
  const items = labels.map((label) => (
    <LabelPickerItem
      key={label.id}
      label={label}
      checked={selected.has(label.id)}
      onToggle={onToggle}
    />
  ));

  if (group == null) return <>{items}</>;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {colorDot(group.color)}
        <span className="flex-1 truncate">{group.name}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">{items}</DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
