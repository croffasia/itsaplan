import { useState, type ReactNode } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { formatDate, parseDate, toDateStr } from '@/utils/dates';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pill } from './Pill';
import ReadOnlyPill from './ReadOnlyPill';

// A date value as a "MMM d, yyyy" pill opening a calendar. Value is a
// "YYYY-MM-DD" string or null; onChange(null) clears it. `trigger` replaces the
// pill where a caller needs its own (the filter condition pills).
export default function DatePill({
  value,
  placeholder,
  onChange,
  readOnly,
  trigger,
}: {
  value: string | null;
  placeholder?: string;
  onChange: (v: string | null) => void;
  readOnly?: boolean;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pill = trigger ?? (
    <Pill active={!!value}>
      <CalendarIcon />
      {value ? formatDate(value) : placeholder}
    </Pill>
  );
  if (readOnly) return <ReadOnlyPill>{pill}</ReadOnlyPill>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{pill}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parseDate(value) ?? undefined}
          onSelect={(d) => {
            onChange(d ? toDateStr(d) : null);
            setOpen(false);
          }}
          autoFocus
        />
        {value && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(null)}>
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
