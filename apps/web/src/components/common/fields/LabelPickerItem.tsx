import type { Label } from '@/lib/api';
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { colorDot } from './colorDot';

// Toggles its selection and keeps the menu open (preventDefault on select), so
// several labels can be picked in one visit.
export default function LabelPickerItem({
  label,
  checked,
  onToggle,
}: {
  label: Label;
  checked: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      onSelect={(e) => {
        e.preventDefault();
        onToggle(label.id);
      }}
    >
      {colorDot(label.color)}
      <span className="flex-1 truncate">{label.name}</span>
    </DropdownMenuCheckboxItem>
  );
}
