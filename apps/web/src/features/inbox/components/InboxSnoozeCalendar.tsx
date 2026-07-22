import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// The calendar behind the "Pick a date…" snooze option. The trigger is an invisible
// anchor inside the row, so the popover opens next to the row's actions.
export default function InboxSnoozeCalendar({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (until: string) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span className="pointer-events-none absolute" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end" onClick={(e) => e.stopPropagation()}>
        <Calendar
          mode="single"
          autoFocus
          disabled={{ before: new Date() }}
          onSelect={(d) => {
            onOpenChange(false);
            if (!d) return;
            d.setHours(9, 0, 0, 0);
            onPick(d.toISOString());
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
