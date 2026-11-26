import { Check } from 'lucide-react';
import type { FieldOption } from '@/utils/filterFields';
import { cn } from '@/lib/utils';
import { CommandItem } from '@/components/ui/command';

// One value in the filter menu: its icon and name, how many issues on the board hold
// it, and, where several values can be ticked, a checkbox. `id` is unique within the
// menu; the search matches the name and the option's keywords only.
export default function FilterMenuRow({
  id,
  option,
  count,
  checked,
  onSelect,
}: {
  id: string;
  option: FieldOption;
  count?: number;
  // Left out where picking the value adds it rather than ticking it.
  checked?: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={id}
      keywords={[option.label, ...(option.keywords ?? [])]}
      onSelect={onSelect}
      // A click would move the focus to the list. The search keeps it, so typing and
      // Backspace still work after a value is ticked with the mouse.
      onMouseDown={(e) => e.preventDefault()}
      aria-checked={checked}
    >
      {checked !== undefined && (
        <span
          aria-hidden
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input',
            checked && 'border-primary bg-primary',
          )}
        >
          {checked && <Check className="size-3 text-primary-foreground" />}
        </span>
      )}
      {option.icon}
      <span className="flex-1 truncate">{option.label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      )}
    </CommandItem>
  );
}
