'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, MapPin, Trash2, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CalendarEvent, CalendarEventInput, GoogleCalendarInfo } from '@/lib/api';
import {
  allDayEndForApi,
  allDayEndForForm,
  eventBounds,
  fromLocalInput,
  toLocalInput,
} from '../utils/calendar';

// What the dialog is opened with: an existing event to edit, or the slot that was
// clicked in the grid.
export interface EventDraftState {
  event: CalendarEvent | null;
  start: Date;
  end: Date;
  allDay: boolean;
}

export default function EventDialog({
  draft,
  calendars,
  canEdit,
  canDelete,
  saving,
  deleting,
  onClose,
  onSave,
  onDelete,
}: {
  draft: EventDraftState | null;
  calendars: GoogleCalendarInfo[];
  canEdit: boolean;
  canDelete: boolean;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (input: CalendarEventInput, eventId: string | null) => void;
  onDelete: (event: CalendarEvent) => void;
}) {
  const writable = calendars.filter((calendar) => calendar.writable);
  const [calendarId, setCalendarId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  // The form is filled from whatever the dialog was opened with, each time it opens.
  useEffect(() => {
    if (!draft) return;
    const event = draft.event;
    setCalendarId(
      event?.calendarId ?? (writable.find((calendar) => calendar.primary) ?? writable[0])?.id ?? '',
    );
    setTitle(event?.title ?? '');
    setDescription(event?.description ?? '');
    setLocation(event?.location ?? '');
    setAllDay(event ? event.allDay : draft.allDay);

    if (event?.allDay) {
      setStart(event.start);
      setEnd(allDayEndForForm(event.end));
      return;
    }
    const bounds = event ? eventBounds(event) : { start: draft.start, end: draft.end };
    setStart(toLocalInput(bounds.start, false));
    setEnd(toLocalInput(bounds.end, false));
    // Only the identity of the opened event matters here; the fields are its copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.event?.id, draft?.start?.getTime(), draft?.allDay]);

  if (!draft) return null;
  const event = draft.event;
  // An entry in a calendar the account can only read is shown, not edited.
  const editable =
    canEdit &&
    (event === null ||
      calendars.find((calendar) => calendar.id === event.calendarId)?.writable !== false);

  // Switching to all-day keeps the day, and switching back keeps a sensible hour.
  const onAllDayChange = (next: boolean) => {
    setAllDay(next);
    const from = start ? new Date(start) : draft.start;
    const to = end ? new Date(end) : draft.end;
    setStart(toLocalInput(from, next));
    setEnd(toLocalInput(next ? from : to, next));
  };

  const submit = () => {
    onSave(
      {
        calendarId,
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        start: fromLocalInput(start, allDay),
        end: allDay ? allDayEndForApi(end || start) : fromLocalInput(end, false),
        allDay,
      },
      event?.id ?? null,
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? 'Event' : 'New event'}</DialogTitle>
          <DialogDescription>
            {editable
              ? 'Saved straight into the Google calendar you pick.'
              : 'This calendar is read-only for the connected account.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              disabled={!editable}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is happening?"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="event-all-day" className="font-normal">
              All day
            </Label>
            <Switch
              id="event-all-day"
              checked={allDay}
              disabled={!editable}
              onCheckedChange={onAllDayChange}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-start">Starts</Label>
              <Input
                id="event-start"
                type={allDay ? 'date' : 'datetime-local'}
                value={start}
                disabled={!editable}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end">{allDay ? 'Last day' : 'Ends'}</Label>
              <Input
                id="event-end"
                type={allDay ? 'date' : 'datetime-local'}
                value={end}
                disabled={!editable}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-calendar">Calendar</Label>
            <Select
              value={calendarId}
              onValueChange={setCalendarId}
              disabled={!editable || event !== null}
            >
              <SelectTrigger id="event-calendar" className="w-full">
                <SelectValue placeholder="Pick a calendar" />
              </SelectTrigger>
              <SelectContent>
                {(event ? calendars : writable).map((calendar) => (
                  <SelectItem key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              value={location}
              disabled={!editable}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Notes</Label>
            <Textarea
              id="event-description"
              value={description}
              disabled={!editable}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {event && (
            <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {event.location}
                </span>
              )}
              {event.attendees > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {event.attendees} guests
                </span>
              )}
              {event.url && (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Open in Google Calendar
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {event && canDelete && editable ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={deleting}
              onClick={() => onDelete(event)}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {editable && (
              <Button
                onClick={submit}
                disabled={saving || title.trim().length === 0 || !calendarId}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {event ? 'Save' : 'Add event'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
