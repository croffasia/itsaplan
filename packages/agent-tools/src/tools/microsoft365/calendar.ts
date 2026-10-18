import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { graphRequest, msCredential, msUser, recipients } from './client';

const user = z
  .string()
  .optional()
  .describe('Calendar owner (email address). Defaults to the credential default user.');

// A model passes "2026-10-20" or a full ISO time; Graph wants a date-time.
export function isoDateTime(raw: unknown, endOfDay = false): string {
  const value = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`"${value}" is not a date or date-time.`);
  return date.toISOString().replace(/\.\d{3}Z$/, '');
}

export const microsoft365CalendarList: CustomToolEntry = {
  key: 'microsoft365_calendar_list',
  label: 'Microsoft 365 List Events',
  scopes: ['Calendars.Read'],
  description:
    'List the events in an Outlook calendar between two dates, recurring ones expanded. Times are UTC.',
  inputSchema: z.object({
    from: z.string().min(1).describe('Start date or date-time, e.g. "2026-10-20".'),
    to: z.string().min(1).describe('End date or date-time.'),
    user,
  }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    const params = new URLSearchParams({
      startDateTime: isoDateTime(input.from),
      endDateTime: isoDateTime(input.to, true),
      $top: '100',
      $orderby: 'start/dateTime',
      $select:
        'id,subject,start,end,location,organizer,attendees,isOnlineMeeting,onlineMeeting,webLink',
    });
    const body = await graphRequest(cred, {
      path: `users/${msUser(cred, input.user)}/calendarView?${params}`,
      permission: 'Calendars.Read',
      headers: { Prefer: 'outlook.timezone="UTC"' },
    });
    return {
      events: (body.value ?? []).map((e) => ({
        id: String(e.id ?? ''),
        subject: e.subject ?? '',
        start: (e.start as { dateTime?: string })?.dateTime ?? null,
        end: (e.end as { dateTime?: string })?.dateTime ?? null,
        location: (e.location as { displayName?: string })?.displayName || null,
        organizer:
          (e.organizer as { emailAddress?: { address?: string } })?.emailAddress?.address ?? null,
        attendees: ((e.attendees as { emailAddress?: { address?: string } }[]) ?? [])
          .map((a) => a.emailAddress?.address)
          .filter(Boolean),
        joinUrl: (e.onlineMeeting as { joinUrl?: string } | null)?.joinUrl ?? null,
        webLink: e.webLink ?? null,
      })),
    };
  },
};

export const microsoft365CalendarCreate: CustomToolEntry = {
  key: 'microsoft365_calendar_create',
  writes: true,
  label: 'Microsoft 365 Create Event',
  scopes: ['Calendars.ReadWrite'],
  description:
    'Create an event in an Outlook calendar. Attendees get an invitation. Set teamsMeeting to add a Microsoft Teams link. Times are UTC.',
  inputSchema: z.object({
    subject: z.string().min(1).describe('Event title.'),
    start: z.string().min(1).describe('Start date-time in UTC, e.g. "2026-10-20T09:00:00".'),
    end: z.string().min(1).describe('End date-time in UTC.'),
    attendees: z.array(z.email()).optional().describe('Attendee email addresses.'),
    location: z.string().optional().describe('Where it takes place.'),
    body: z.string().optional().describe('Description, plain text.'),
    teamsMeeting: z.boolean().optional().describe('Add a Microsoft Teams meeting link.'),
    user,
  }),
  execute: async (credential, input) => {
    const cred = msCredential(credential);
    const event = await graphRequest(cred, {
      method: 'POST',
      path: `users/${msUser(cred, input.user)}/events`,
      permission: 'Calendars.ReadWrite',
      json: {
        subject: String(input.subject),
        start: { dateTime: isoDateTime(input.start), timeZone: 'UTC' },
        end: { dateTime: isoDateTime(input.end), timeZone: 'UTC' },
        ...(input.location ? { location: { displayName: String(input.location) } } : {}),
        ...(input.body ? { body: { contentType: 'text', content: String(input.body) } } : {}),
        attendees: recipients(input.attendees).map((a) => ({ ...a, type: 'required' })),
        ...(input.teamsMeeting
          ? { isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness' }
          : {}),
      },
    });
    return {
      id: String(event.id ?? ''),
      subject: event.subject ?? input.subject,
      webLink: event.webLink ?? null,
      joinUrl: (event.onlineMeeting as { joinUrl?: string } | null)?.joinUrl ?? null,
    };
  },
};
