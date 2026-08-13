import { Clock2Icon } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';

// An "HH:mm" time input with a clock addon. The browser's own picker indicator is
// hidden: the addon stands in for it and the field is typed into.
export default function TimeInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        type="time"
        value={value}
        className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
      <InputGroupAddon align="inline-end">
        <Clock2Icon className="text-muted-foreground" />
      </InputGroupAddon>
    </InputGroup>
  );
}
