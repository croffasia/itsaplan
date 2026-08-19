import { useId, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  formatDateTimeRange,
  fromZonedParts,
  parseDate,
  toDateStr,
  toZonedParts,
} from '@/utils/dates';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pill } from './Pill';
import ReadOnlyPill from './ReadOnlyPill';
import TimeInput from './TimeInput';
import { useTranslations } from 'next-intl';

// The times a first pick lands on while the field is still empty.
const DEFAULT_START = '09:00';
const DEFAULT_END = '10:00';
// The last minute a range can end on: the pill edits a range inside one day.
const LAST_MINUTE = 23 * 60 + 59;

function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function toTime(minutes: number): string {
  const m = Math.max(0, Math.min(minutes, LAST_MINUTE));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// A moment (or a range within one day) as a pill opening a calendar with the
// time under it. Values are ISO datetimes or null; onChange(null, null) clears
// them. The day and both times are read and written in the user's display zone,
// so the picker shows the same wall clock the value renders as.
export default function DateTimePill({
  value,
  valueEnd,
  range,
  placeholder,
  onChange,
  readOnly,
}: {
  value: string | null;
  valueEnd: string | null;
  // True for a datetime_range field: the popover also asks for an end time.
  range: boolean;
  placeholder?: string;
  onChange: (value: string | null, valueEnd: string | null) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('common');
  const tField = useTranslations('issue.customFields');
  const [open, setOpen] = useState(false);
  const id = useId();
  const start = value ? toZonedParts(value) : null;
  const end = valueEnd ? toZonedParts(valueEnd) : null;
  // The times the popover shows, defaulted while the field is still unset. A
  // range always carries an end, so picking a day fills both.
  const startTime = start?.time ?? DEFAULT_START;
  const endTime = end?.time ?? DEFAULT_END;

  const pill = (
    <Pill active={!!value}>
      <CalendarClock />
      <span className="truncate">
        {value ? formatDateTimeRange(value, range ? valueEnd : null) : placeholder}
      </span>
    </Pill>
  );
  if (readOnly) return <ReadOnlyPill>{pill}</ReadOnlyPill>;

  // Writes the value back from the parts the popover edits. An end that is not
  // after the start is dropped, which is what the API accepts. The times are
  // editable before a day is picked, so a time alone lands on today.
  function emit(day: string | undefined, startTime: string, endTime: string) {
    const on = day ?? start?.day ?? toDateStr(new Date());
    const nextEnd = range && endTime > startTime ? fromZonedParts(on, endTime) : null;
    onChange(fromZonedParts(on, startTime), nextEnd);
  }

  // Moving the start carries the end with it, so the range keeps its length
  // instead of losing an end that would land before the new start.
  function changeStart(time: string) {
    emit(undefined, time, toTime(toMinutes(endTime) + toMinutes(time) - toMinutes(startTime)));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{pill}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parseDate(start?.day ?? null) ?? undefined}
          onSelect={(d) => d && emit(toDateStr(d), startTime, endTime)}
          autoFocus
        />
        <FieldGroup className="gap-3 border-t p-3">
          <Field>
            <FieldLabel htmlFor={`${id}-start`}>
              {range ? tField('startTime') : tField('time')}
            </FieldLabel>
            <TimeInput id={`${id}-start`} value={startTime} onChange={changeStart} />
          </Field>
          {range && (
            <Field>
              <FieldLabel htmlFor={`${id}-end`}>{tField('endTime')}</FieldLabel>
              <TimeInput
                id={`${id}-end`}
                value={endTime}
                onChange={(time) => emit(undefined, startTime, time)}
              />
            </Field>
          )}
        </FieldGroup>
        {value && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange(null, null)}
            >
              {t('clear')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
