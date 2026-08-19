import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PopoverTrigger } from '@/components/ui/popover';

// The trigger the provider and model pickers share, so the two controls of the Model
// section read as one control shown twice. Renders the picked value, or the
// placeholder in muted text when nothing is picked yet.
export function AgentComboboxTrigger({
  value,
  placeholder,
  open,
  disabled,
}: {
  value: string;
  placeholder: string;
  open: boolean;
  disabled?: boolean;
}) {
  return (
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className="w-full justify-between font-normal"
      >
        <span className={value ? 'truncate' : 'truncate text-muted-foreground'}>
          {value || placeholder}
        </span>
        <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
  );
}
