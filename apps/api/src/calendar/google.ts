import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getGoogleConfig, isGoogleUsable } from '@repo/auth';
import { HttpError } from '../shared/lib';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const API_BASE = 'https://www.googleapis.com/calendar/v3';

// Reading the calendar list and reading and writing events. Narrower than the full
// calendar scope: it cannot create or delete a calendar, only entries in one.
export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

const STATE_TTL_MS = 10 * 60 * 1000;

// The value that has to be registered as an authorized redirect URI in the Google
// Cloud console. It is a different path from the sign-in callback, which is why the
// owner has to add this one too even when Google sign-in already works.
export function calendarRedirectUri(): string {
  return `${process.env.API_URL}/calendar/google/callback`;
}

export interface GoogleTokens {
  refreshToken: string;
  accessToken: string;
  // Epoch milliseconds. A token is refreshed before this, not after it.
  accessTokenExpiresAt: number;
}

// The OAuth `state` is signed rather than stored, so a consent that is never
// finished leaves nothing behind. It binds the round trip to one member and one
// project, and the callback rejects a state that does not match its own session.
function stateSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set');
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url');
}

export function encodeState(projectId: number, userId: string): string {
  const payload = [
    projectId,
    userId,
    Date.now() + STATE_TTL_MS,
    randomBytes(9).toString('base64url'),
  ].join('|');
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

export function decodeState(state: string): { projectId: number; userId: string } | null {
  const cut = state.lastIndexOf('.');
  if (cut <= 0) return null;
  const payload = Buffer.from(state.slice(0, cut), 'base64url').toString();
  const given = Buffer.from(state.slice(cut + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const [projectId, userId, expiresAt] = payload.split('|');
  if (!projectId || !userId || !expiresAt) return null;
  if (Number(expiresAt) < Date.now()) return null;
  return { projectId: Number(projectId), userId };
}

// The instance-wide Google OAuth client, the same one god mode configures for
// sign-in. A calendar cannot be connected before it is set.
async function client(): Promise<{ clientId: string; clientSecret: string }> {
  const config = await getGoogleConfig();
  if (!isGoogleUsable(config)) {
    throw new HttpError(409, 'Google is not configured on this instance yet');
  }
  return { clientId: config.clientId, clientSecret: config.clientSecret };
}

export async function hasGoogleClient(): Promise<boolean> {
  return isGoogleUsable(await getGoogleConfig());
}

export async function consentUrl(state: string): Promise<string> {
  const { clientId } = await client();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: calendarRedirectUri(),
    response_type: 'code',
    scope: CALENDAR_SCOPES.join(' '),
    // Google returns a refresh token on the first consent only, so ask for the
    // consent screen every time: reconnecting after a revoked token has to produce
    // a new one.
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

async function token(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  return (await response.json()) as TokenResponse;
}

export async function exchangeCode(
  code: string,
): Promise<{ tokens: GoogleTokens; scopes: string[] }> {
  const { clientId, clientSecret } = await client();
  const result = await token({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: calendarRedirectUri(),
    grant_type: 'authorization_code',
  });
  if (!result.access_token || !result.refresh_token) {
    throw new HttpError(502, 'Google did not return a usable token');
  }
  return {
    tokens: {
      refreshToken: result.refresh_token,
      accessToken: result.access_token,
      accessTokenExpiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
    },
    scopes: (result.scope ?? '').split(' ').filter(Boolean),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = await client();
  const result = await token({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  // A refusal here means the member revoked access or the credentials changed, and
  // reconnecting is the only way back.
  if (!result.access_token) throw new HttpError(401, 'Google refused the stored calendar token');
  return {
    refreshToken,
    accessToken: result.access_token,
    accessTokenExpiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  };
}

export async function revokeToken(refreshToken: string): Promise<void> {
  await fetch(REVOKE_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }).toString(),
  }).catch(() => undefined);
}

// ── Calendar API ──────────────────────────────────────────────────────────────

async function call<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
  });
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(401, 'Google refused the stored calendar token');
  }
  // The body of a failure carries the account's own data, so it is not passed on.
  if (!response.ok) throw new HttpError(502, 'Google Calendar rejected the request');
  return response.status === 204 ? null : ((await response.json()) as T);
}

export interface GoogleCalendar {
  id: string;
  name: string;
  description: string | null;
  color: string;
  primary: boolean;
  writable: boolean;
  timeZone: string | null;
}

interface CalendarListItem {
  id: string;
  summary?: string;
  summaryOverride?: string;
  description?: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
  timeZone?: string;
  deleted?: boolean;
}

export async function listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
  const data = await call<{ items?: CalendarListItem[] }>(
    accessToken,
    '/users/me/calendarList?minAccessRole=reader&maxResults=250',
  );
  return (data?.items ?? [])
    .filter((item) => !item.deleted)
    .map((item) => ({
      id: item.id,
      name: item.summaryOverride ?? item.summary ?? item.id,
      description: item.description ?? null,
      color: item.backgroundColor ?? '#9aa0a6',
      primary: item.primary === true,
      writable: item.accessRole === 'owner' || item.accessRole === 'writer',
      timeZone: item.timeZone ?? null,
    }));
}

export interface GoogleEvent {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  // An ISO timestamp, or YYYY-MM-DD when allDay is true.
  start: string;
  end: string;
  allDay: boolean;
  url: string | null;
  organizer: string | null;
  attendees: number;
}

interface EventItem {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  organizer?: { email?: string; displayName?: string };
  attendees?: unknown[];
}

function toEvent(calendarId: string, item: EventItem): GoogleEvent | null {
  const start = item.start?.dateTime ?? item.start?.date;
  const end = item.end?.dateTime ?? item.end?.date;
  if (!start || !end) return null;
  return {
    id: item.id,
    calendarId,
    title: item.summary ?? 'Untitled',
    description: item.description ?? null,
    location: item.location ?? null,
    start,
    end,
    allDay: item.start?.date != null,
    url: item.htmlLink ?? null,
    organizer: item.organizer?.displayName ?? item.organizer?.email ?? null,
    attendees: item.attendees?.length ?? 0,
  };
}

// Google expands recurring entries when singleEvents is set, so the view never has
// to work out a recurrence rule itself.
export async function listEvents(
  accessToken: string,
  calendarId: string,
  from: string,
  to: string,
): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin: from,
    timeMax: to,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  });
  const data = await call<{ items?: EventItem[] }>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  );
  return (data?.items ?? [])
    .filter((item) => item.status !== 'cancelled')
    .map((item) => toEvent(calendarId, item))
    .filter((event): event is GoogleEvent => event !== null);
}

export interface EventDraft {
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  allDay: boolean;
}

function toGoogleBody(draft: EventDraft): Record<string, unknown> {
  const bound = (value: string) => (draft.allDay ? { date: value } : { dateTime: value });
  return {
    summary: draft.title,
    description: draft.description ?? '',
    location: draft.location ?? '',
    start: bound(draft.start),
    end: bound(draft.end),
  };
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  draft: EventDraft,
): Promise<GoogleEvent> {
  const item = await call<EventItem>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(toGoogleBody(draft)) },
  );
  const event = item ? toEvent(calendarId, item) : null;
  if (!event) throw new HttpError(502, 'Google Calendar rejected the request');
  return event;
}

export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  draft: EventDraft,
): Promise<GoogleEvent> {
  const item = await call<EventItem>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: JSON.stringify(toGoogleBody(draft)) },
  );
  const event = item ? toEvent(calendarId, item) : null;
  if (!event) throw new HttpError(502, 'Google Calendar rejected the request');
  return event;
}

export async function removeEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  await call(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  );
}

export async function fetchAccountEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return 'unknown';
  const data = (await response.json()) as { email?: string };
  return data.email ?? 'unknown';
}
