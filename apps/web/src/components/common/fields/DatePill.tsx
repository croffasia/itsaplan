import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pill } from './Pill';
import ReadOnlyPill from './ReadOnlyPill';

// A date value as a "MMM d, yyyy" pill opening a calendar. Value is a
// "YYYY-MM-DD" string or null; onChange(null) clears it.
export default function DatePill({
  value,
  placeholder,
  onChange,
  readOnly,
}: {
  value: string | null;
  placeholder: string;
  onChange: (v: string | null) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pill = (
    <Pill active={!!value}>
      <CalendarIcon />
      {value ? format(parseISO(value), 'MMM d, yyyy') : placeholder}
    </Pill>
  );
  if (readOnly) return <ReadOnlyPill>{pill}</ReadOnlyPill>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{pill}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? parseISO(value) : undefined}
          onSelect={(d) => {
            onChange(d ? format(d, 'yyyy-MM-dd') : null);
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
