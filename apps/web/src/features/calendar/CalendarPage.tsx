'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addHours, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useShell } from '@/context/shellContext';
import type { CalendarEvent, CalendarEventInput } from '@/lib/api';
import { cn } from '@/lib/utils';
import CalendarConnectPanel from './components/CalendarConnectPanel';
import CalendarList from './components/CalendarList';
import EventDialog, { type EventDraftState } from './components/EventDialog';
import MonthGrid from './components/MonthGrid';
import TimeGrid from './components/TimeGrid';
import {
  VIEWS,
  fetchWindow,
  moveAnchor,
  viewTitle,
  visibleDays,
  type CalendarView,
} from './utils/calendar';
import {
  useCalendarConnectionQuery,
  useCalendarEventsQuery,
  useCalendarsQuery,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useDisconnectCalendar,
  useSetHiddenCalendars,
  useStartCalendarConnect,
  useUpdateCalendarEvent,
} from './services/calendar.service';

// What the OAuth callback reports back in the URL when it sends the browser here.
const CALLBACK_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Google Calendar connected' },
  denied: { ok: false, text: 'The Google consent was cancelled' },
  failed: { ok: false, text: 'Google did not complete the connection' },
  state: { ok: false, text: 'That connect link was no longer valid' },
};

export default function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';

  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [draft, setDraft] = useState<EventDraftState | null>(null);

  const connectionQuery = useCalendarConnectionQuery(projectKey);
  const connection = connectionQuery.data;
  const connected = connection?.connected === true;

  const calendarsQuery = useCalendarsQuery(projectKey, connected);
  const window = useMemo(() => fetchWindow(view, anchor), [view, anchor]);
  const eventsQuery = useCalendarEventsQuery(projectKey, window.from, window.to, connected);

  const connect = useStartCalendarConnect(projectKey);
  const disconnect = useDisconnectCalendar(projectKey);
  const setHidden = useSetHiddenCalendars(projectKey);
  const createEvent = useCreateCalendarEvent(projectKey);
  const updateEvent = useUpdateCalendarEvent(projectKey);
  const deleteEvent = useDeleteCalendarEvent(projectKey);

  // The callback lands on this page with its result in the query string. It is
  // reported once and then removed, so a reload does not repeat it.
  useEffect(() => {
    const result = searchParams.get('calendar');
    if (!result) return;
    const message = CALLBACK_MESSAGES[result];
    if (message) (message.ok ? toast.success : toast.error)(message.text);
    router.replace(globalThis.location.pathname);
  }, [searchParams, router]);

  if (!project || connectionQuery.isLoading) return <Skeleton className="m-6 flex-1" />;
  if (!can('calendar', 'read') || !connection) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to the calendar.
      </div>
    );
  }

  if (!connected) {
    return (
      <CalendarConnectPanel
        connection={connection}
        canConnect={can('calendar', 'edit')}
        connecting={connect.isPending}
        onConnect={() => connect.mutate()}
      />
    );
  }

  const days = visibleDays(view, anchor);
  const events = eventsQuery.data ?? [];
  const calendars = calendarsQuery.data ?? [];

  const openEvent = (event: CalendarEvent) =>
    setDraft({
      event,
      start: new Date(event.start),
      end: new Date(event.end),
      allDay: event.allDay,
    });

  const openSlot = (day: Date, hour: number | null) => {
    if (!can('calendar', 'create')) return;
    const start = hour === null ? startOfDay(day) : addHours(startOfDay(day), hour);
    setDraft({ event: null, start, end: addHours(start, 1), allDay: hour === null });
  };

  const save = (input: CalendarEventInput, eventId: string | null) => {
    const done = () => setDraft(null);
    if (eventId) updateEvent.mutate({ eventId, input }, { onSuccess: done });
    else createEvent.mutate(input, { onSuccess: done });
  };

  const toggleCalendar = (calendarId: string) => {
    const hidden = connection.hiddenCalendarIds;
    setHidden.mutate(
      hidden.includes(calendarId)
        ? hidden.filter((id) => id !== calendarId)
        : [...hidden, calendarId],
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
          Today
        </Button>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Previous"
            onClick={() => setAnchor(moveAnchor(view, anchor, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Next"
            onClick={() => setAnchor(moveAnchor(view, anchor, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <h1 className="min-w-0 truncate text-sm font-medium">{viewTitle(view, anchor)}</h1>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex rounded-md border p-0.5">
            {VIEWS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={cn(
                  'rounded-[5px] px-2.5 py-1 text-xs capitalize',
                  option === view
                    ? 'bg-accent font-medium'
                    : 'text-muted-foreground hover:bg-accent/60',
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Refresh"
            onClick={() => void eventsQuery.refetch()}
          >
            <RefreshCw className={cn('size-4', eventsQuery.isFetching && 'animate-spin')} />
          </Button>
          {can('calendar', 'create') && (
            <Button size="sm" onClick={() => openSlot(anchor, new Date().getHours())}>
              <Plus className="size-4" />
              Event
            </Button>
          )}
        </div>
      </header>

      {connection.lastError && (
        <p className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          Google refused the stored access. Disconnect and connect again to renew it.
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex min-h-0 flex-col">
          {eventsQuery.isLoading ? (
            <Skeleton className="flex-1 rounded-xl" />
          ) : eventsQuery.isError ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
              Could not read the calendar from Google.
            </div>
          ) : view === 'month' ? (
            <MonthGrid
              days={days}
              anchor={anchor}
              events={events}
              calendars={calendars}
              onOpenEvent={openEvent}
              onOpenDay={(day) => {
                setAnchor(day);
                setView('day');
              }}
              onCreateAt={(day) => openSlot(day, null)}
            />
          ) : (
            <TimeGrid
              days={days}
              events={events}
              calendars={calendars}
              onOpenEvent={openEvent}
              onCreateAt={(day, hour) => openSlot(day, hour)}
            />
          )}
        </div>

        <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto lg:flex">
          <CalendarList
            calendars={calendars}
            hidden={connection.hiddenCalendarIds}
            loading={calendarsQuery.isLoading}
            onToggle={toggleCalendar}
          />

          <div className="mt-auto space-y-2 border-t pt-3">
            <p className="px-1 text-xs text-muted-foreground">
              Connected as
              <span className="block truncate font-medium text-foreground">
                {connection.accountEmail}
              </span>
            </p>
            {can('calendar', 'edit') && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate()}
              >
                {disconnect.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Unplug className="size-3.5" />
                )}
                Disconnect
              </Button>
            )}
          </div>
        </aside>
      </div>

      <EventDialog
        draft={draft}
        calendars={calendars}
        canEdit={can('calendar', 'edit') || can('calendar', 'create')}
        canDelete={can('calendar', 'delete')}
        saving={createEvent.isPending || updateEvent.isPending}
        deleting={deleteEvent.isPending}
        onClose={() => setDraft(null)}
        onSave={save}
        onDelete={(event) =>
          deleteEvent.mutate(
            { eventId: event.id, calendarId: event.calendarId },
            { onSuccess: () => setDraft(null) },
          )
        }
      />
    </div>
  );
}
