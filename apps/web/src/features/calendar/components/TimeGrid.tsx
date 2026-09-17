'use client';

import { useEffect, useRef } from 'react';
import { format, isToday } from 'date-fns';
import type { CalendarEvent, GoogleCalendarInfo } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  HOUR_HEIGHT,
  MINUTES_PER_DAY,
  calendarColor,
  eventsOn,
  placeDayEvents,
  textOn,
} from '../utils/calendar';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
// The grid opens on the working day rather than on midnight.
const SCROLL_TO_HOUR = 7;

function NowLine({ day }: { day: Date }) {
  if (!isToday(day)) return null;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return (
    <div
      className="pointer-events-none absolute right-0 left-0 z-20 border-t border-destructive"
      style={{ top: (minutes / MINUTES_PER_DAY) * (HOUR_HEIGHT * 24) }}
    >
      <span className="absolute -top-1 -left-1 size-2 rounded-full bg-destructive" />
    </div>
  );
}

// The week and day views are the same grid with a different number of columns: an
// all-day strip at the top, then one scrolling column of hours per day.
export default function TimeGrid({
  days,
  events,
  calendars,
  onOpenEvent,
  onCreateAt,
}: {
  days: Date[];
  events: CalendarEvent[];
  calendars: GoogleCalendarInfo[];
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateAt: (day: Date, hour: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: SCROLL_TO_HOUR * HOUR_HEIGHT });
  }, []);

  const allDay = days.map((day) => eventsOn(events, day).filter((event) => event.allDay));
  const hasAllDay = allDay.some((list) => list.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex border-b">
        <div className="w-14 shrink-0 border-r" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="min-w-0 flex-1 border-r py-1.5 text-center last:border-r-0"
          >
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              {format(day, 'EEE')}
            </p>
            <p
              className={cn(
                'mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full text-sm tabular-nums',
                isToday(day) && 'bg-foreground font-semibold text-background',
              )}
            >
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {hasAllDay && (
        <div className="flex border-b">
          <div className="w-14 shrink-0 border-r px-2 py-1 text-right text-xs text-muted-foreground">
            All day
          </div>
          {days.map((day, index) => (
            <div
              key={day.toISOString()}
              className="min-w-0 flex-1 space-y-0.5 border-r p-1 last:border-r-0"
            >
              {allDay[index].map((event) => (
                <button
                  key={`${event.calendarId}:${event.id}`}
                  type="button"
                  onClick={() => onOpenEvent(event)}
                  className="block w-full truncate rounded px-1.5 py-0.5 text-left text-xs"
                  style={{
                    backgroundColor: calendarColor(calendars, event.calendarId),
                    color: textOn(calendarColor(calendars, event.calendarId)),
                  }}
                >
                  {event.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex" style={{ height: HOUR_HEIGHT * 24 }}>
          <div className="w-14 shrink-0 border-r">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="relative border-b text-right"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-1.5 bg-card px-0.5 text-xs text-muted-foreground tabular-nums">
                  {hour > 0 && `${String(hour).padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="relative min-w-0 flex-1 border-r last:border-r-0"
            >
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  aria-label={`Add an event at ${String(hour).padStart(2, '0')}:00`}
                  onClick={() => onCreateAt(day, hour)}
                  className="block w-full border-b hover:bg-accent/40"
                  style={{ height: HOUR_HEIGHT }}
                />
              ))}

              <NowLine day={day} />

              {placeDayEvents(eventsOn(events, day), day).map((placed) => {
                const width = 100 / placed.columns;
                return (
                  <button
                    key={`${placed.event.calendarId}:${placed.event.id}`}
                    type="button"
                    onClick={() => onOpenEvent(placed.event)}
                    title={placed.event.title}
                    className="absolute z-10 overflow-hidden rounded px-1.5 py-0.5 text-left text-xs shadow-sm"
                    style={{
                      top: (placed.topMinutes / MINUTES_PER_DAY) * (HOUR_HEIGHT * 24),
                      height: (placed.heightMinutes / MINUTES_PER_DAY) * (HOUR_HEIGHT * 24) - 2,
                      left: `calc(${placed.column * width}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                      backgroundColor: calendarColor(calendars, placed.event.calendarId),
                      color: textOn(calendarColor(calendars, placed.event.calendarId)),
                    }}
                  >
                    <span className="block truncate font-medium">{placed.event.title}</span>
                    <span className="block truncate tabular-nums opacity-80">
                      {format(new Date(placed.event.start), 'HH:mm')}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
