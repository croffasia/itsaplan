import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function DisplaySettingsSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  // A closed Radix Select still renders all its items to find the selected label.
  // The Display popover renders several of these on every open, so the label is
  // passed in and the items render from the first focus or open. They stay mounted
  // after that: a focused closed trigger picks an item by typed letters, and the
  // list animates out on close.
  const [used, setUsed] = useState(false);
  return (
    <Select value={value} onValueChange={onChange} onOpenChange={(open) => open && setUsed(true)}>
      <SelectTrigger
        size="sm"
        className="gap-1 border-0 bg-transparent px-2 font-medium shadow-none hover:bg-accent data-[size=sm]:h-7 dark:bg-transparent dark:hover:bg-accent"
        onFocus={() => setUsed(true)}
      >
        <SelectValue>{options.find((o) => o.value === value)?.label}</SelectValue>
      </SelectTrigger>
      {used && (
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      )}
    </Select>
  );
}
