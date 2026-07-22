import { addMonths, format, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CalendarMonthNav({
  cursor,
  onCursorChange,
}: {
  cursor: Date;
  onCursorChange: (date: Date) => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-sm font-medium text-foreground">{format(cursor, 'MMMM yyyy')}</h2>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => onCursorChange(addMonths(cursor, -1))}
          title="Previous month"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => onCursorChange(addMonths(cursor, 1))}
          title="Next month"
        >
          <ChevronRight />
        </Button>
      </div>
      <Button variant="outline" size="sm" onClick={() => onCursorChange(startOfMonth(new Date()))}>
        Today
      </Button>
    </div>
  );
}
