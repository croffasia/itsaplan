'use client';

import { Check, Loader2 } from 'lucide-react';
import type { GoogleCalendarInfo } from '@/lib/api';
import { cn } from '@/lib/utils';

// The calendars of the connected account, each a toggle. Hiding one only changes
// this view: Google's own selection is left alone.
export default function CalendarList({
  calendars,
  hidden,
  loading,
  onToggle,
}: {
  calendars: GoogleCalendarInfo[];
  hidden: string[];
  loading: boolean;
  onToggle: (calendarId: string) => void;
}) {
  const hiddenSet = new Set(hidden);

  return (
    <div className="space-y-1">
      <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Calendars
      </p>
      {loading ? (
        <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Reading the account…
        </p>
      ) : calendars.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">This account has no calendars.</p>
      ) : (
        <ul>
          {calendars.map((calendar) => {
            const shown = !hiddenSet.has(calendar.id);
            return (
              <li key={calendar.id}>
                <button
                  type="button"
                  onClick={() => onToggle(calendar.id)}
                  className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-accent/60"
                  aria-pressed={shown}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                      !shown && 'opacity-40',
                    )}
                    style={{
                      backgroundColor: shown ? calendar.color : 'transparent',
                      borderColor: calendar.color,
                    }}
                  >
                    {shown && <Check className="size-3 text-white" strokeWidth={3} />}
                  </span>
                  <span
                    className={cn('min-w-0 flex-1 truncate', !shown && 'text-muted-foreground')}
                  >
                    {calendar.name}
                  </span>
                  {!calendar.writable && (
                    <span className="shrink-0 text-xs text-muted-foreground">read</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
