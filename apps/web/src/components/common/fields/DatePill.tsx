import { useState, type ComponentProps, type ReactNode } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { formatDate, parseDate, toDateStr } from '@/utils/dates';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pill } from './Pill';
import ReadOnlyPill from './ReadOnlyPill';
import { useTranslations } from 'next-intl';

// A date value as a "MMM d, yyyy" pill opening a calendar. Value is a
// "YYYY-MM-DD" string or null; onChange(null) clears it. `trigger` replaces the
// pill where a caller needs its own (the filter condition pills).
export default function DatePill({
  value,
  placeholder,
  onChange,
  readOnly,
  trigger,
  clearable = true,
  disabled,
}: {
  value: string | null;
  placeholder?: string;
  onChange: (v: string | null) => void;
  readOnly?: boolean;
  trigger?: ReactNode;
  // False on a date the form requires, where offering to clear it would be an
  // action the caller has to ignore.
  clearable?: boolean;
  // Days the caller cannot accept, as react-day-picker matchers ({ before }, { after },
  // { from, to }, …). They render greyed out and cannot be selected.
  disabled?: ComponentProps<typeof Calendar>['disabled'];
}) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const pill = trigger ?? (
    <Pill active={!!value}>
      <CalendarIcon />
      <span className="truncate">{value ? formatDate(value) : placeholder}</span>
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
          disabled={disabled}
          onSelect={(d) => {
            onChange(d ? toDateStr(d) : null);
            setOpen(false);
          }}
          autoFocus
        />
        {value && clearable && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(null)}>
              {t('clear')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
