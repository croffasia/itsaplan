'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// The control most preferences use: a fixed set of named choices.
export default function AccountPreferenceSelect<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectTrigger className="w-full sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
