'use client';

import { format, isSameMonth, isToday } from 'date-fns';
import type { CalendarEvent, GoogleCalendarInfo } from '@/lib/api';
import { cn } from '@/lib/utils';
import { calendarColor, eventsOn, weeksOf } from '../utils/calendar';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Beyond this a cell turns into a "+n more" line instead of growing.
const MAX_PER_DAY = 3;

export default function MonthGrid({
  days,
  anchor,
  events,
  calendars,
  onOpenEvent,
  onOpenDay,
  onCreateAt,
}: {
  days: Date[];
  anchor: Date;
  events: CalendarEvent[];
  calendars: GoogleCalendarInfo[];
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenDay: (day: Date) => void;
  onCreateAt: (day: Date) => void;
}) {
  const weeks = weeksOf(days);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="px-2 py-1.5 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr">
        {weeks.map((week) => (
          <div key={week[0].toISOString()} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map((day) => {
              const dayEvents = eventsOn(events, day);
              const outside = !isSameMonth(day, anchor);
              return (
                <div
                  key={day.toISOString()}
                  onDoubleClick={() => onCreateAt(day)}
                  className={cn(
                    'min-w-0 border-r p-1 last:border-r-0',
                    outside && 'bg-muted/30 text-muted-foreground',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOpenDay(day)}
                    className={cn(
                      'mb-1 flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
                      isToday(day)
                        ? 'bg-foreground font-semibold text-background'
                        : 'hover:bg-accent',
                    )}
                  >
                    {format(day, 'd')}
                  </button>

                  <div className="space-y-0.5">
                    {dayEvents.slice(0, MAX_PER_DAY).map((event) => (
                      <button
                        key={`${event.calendarId}:${event.id}`}
                        type="button"
                        onClick={() => onOpenEvent(event)}
                        title={event.title}
                        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs hover:bg-accent"
                      >
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: calendarColor(calendars, event.calendarId) }}
                        />
                        {!event.allDay && (
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {format(new Date(event.start), 'HH:mm')}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate">{event.title}</span>
                      </button>
                    ))}
                    {dayEvents.length > MAX_PER_DAY && (
                      <button
                        type="button"
                        onClick={() => onOpenDay(day)}
                        className="w-full rounded px-1 py-0.5 text-left text-xs text-muted-foreground hover:bg-accent"
                      >
                        +{dayEvents.length - MAX_PER_DAY} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
