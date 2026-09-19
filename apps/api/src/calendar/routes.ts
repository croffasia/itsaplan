import { Elysia, t } from 'elysia';
import { guards } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { noContent } from '../shared/http';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { getProjectById } from '../projects/store';
import {
  calendarRedirectUri,
  consentUrl,
  decodeState,
  encodeState,
  exchangeCode,
  fetchAccountEmail,
  hasGoogleClient,
  insertEvent,
  listCalendars,
  listEvents,
  patchEvent,
  removeEvent,
  revokeToken,
  type EventDraft,
  type GoogleEvent,
} from './google';
import {
  deleteConnection,
  getAccessToken,
  getConnection,
  saveConnection,
  setHiddenCalendars,
  setLastError,
  takeRefreshToken,
} from './store';

const projectParams = t.Object({ projectKey: t.String() });

const ConnectionResponse = t.Object({
  connected: t.Boolean(),
  accountEmail: t.Nullable(t.String()),
  hiddenCalendarIds: t.Array(t.String()),
  // False when the instance has no Google OAuth client yet: the owner has to set
  // one in god mode before anyone can connect a calendar.
  instanceReady: t.Boolean(),
  redirectUri: t.String(),
  lastError: t.Nullable(t.String()),
  connectedAt: t.Nullable(t.String()),
});

const CalendarResponse = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Nullable(t.String()),
  color: t.String(),
  primary: t.Boolean(),
  writable: t.Boolean(),
  timeZone: t.Nullable(t.String()),
});

const EventResponse = t.Object({
  id: t.String(),
  calendarId: t.String(),
  title: t.String(),
  description: t.Nullable(t.String()),
  location: t.Nullable(t.String()),
  start: t.String(),
  end: t.String(),
  allDay: t.Boolean(),
  url: t.Nullable(t.String()),
  organizer: t.Nullable(t.String()),
  attendees: t.Number(),
});

const DraftBody = {
  title: t.String({ minLength: 1, maxLength: 300 }),
  description: t.Optional(t.Nullable(t.String({ maxLength: 8000 }))),
  location: t.Optional(t.Nullable(t.String({ maxLength: 300 }))),
  start: t.String({ minLength: 4, maxLength: 40 }),
  end: t.String({ minLength: 4, maxLength: 40 }),
  allDay: t.Boolean(),
};

function toDraft(body: {
  title: string;
  description?: string | null;
  location?: string | null;
  start: string;
  end: string;
  allDay: boolean;
}): EventDraft {
  if (new Date(body.end).getTime() < new Date(body.start).getTime()) {
    throw new HttpError(400, 'The event ends before it starts');
  }
  return {
    title: body.title,
    description: body.description ?? null,
    location: body.location ?? null,
    start: body.start,
    end: body.end,
    allDay: body.allDay,
  };
}

// The access token for the member's own connection. A refusal from Google is
// recorded on the row, so the page can say the connection needs renewing instead
// of showing an empty calendar.
async function tokenFor(projectId: number, userId: string): Promise<string> {
  const token = await getAccessToken(projectId, userId).catch(async (error) => {
    if (error instanceof HttpError && error.status === 401) {
      await setLastError(projectId, userId, 'Google refused the stored token');
    }
    throw error;
  });
  if (!token) throw new HttpError(409, 'No Google Calendar is connected');
  return token;
}

function requireUserId(user: { id: string } | null | undefined): string {
  if (!user) throw new HttpError(401, 'Authentication required');
  return user.id;
}

// The calendar is one member's own Google account per project: the OAuth tokens are
// never shared, so every route resolves the connection from the session user rather
// than from the project alone.
export const calendarRoutes = new Elysia({
  name: 'calendar',
  detail: { tags: ['Calendar'] },
})
  .use(authContext)
  .use(guards)

  .get(
    '/projects/:projectKey/calendar/connection',
    async ({ project, user }) => {
      const connection = await getConnection(project.id, requireUserId(user));
      return {
        connected: connection !== null,
        accountEmail: connection?.accountEmail ?? null,
        hiddenCalendarIds: connection?.hiddenCalendarIds ?? [],
        instanceReady: await hasGoogleClient(),
        redirectUri: calendarRedirectUri(),
        lastError: connection?.lastError ?? null,
        connectedAt: connection?.createdAt ?? null,
      };
    },
    {
      params: projectParams,
      permission: ['calendar', 'read'],
      response: {
        200: ConnectionResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Google Calendar connection status' },
    },
  )

  // Hands back the consent URL instead of redirecting: the page opens it itself, so
  // a rejected permission check is still a JSON error the UI can show.
  .post(
    '/projects/:projectKey/calendar/connect',
    async ({ project, user }) => ({
      url: await consentUrl(encodeState(project.id, requireUserId(user))),
    }),
    {
      params: projectParams,
      permission: ['calendar', 'edit'],
      response: {
        200: t.Object({ url: t.String() }),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: { summary: 'Start connecting a Google Calendar' },
    },
  )

  // Where Google sends the browser back. It is a navigation, not an API call, so it
  // always answers with a redirect to the calendar page. The signed state is only
  // accepted for the session that started it, which is what stops a link from
  // another tab or another person attaching their account here.
  .get(
    '/calendar/google/callback',
    async ({ query, user, redirect }) => {
      const appUrl = process.env.APP_URL ?? '';
      const fail = (reason: string) => redirect(`${appUrl}/?calendar=${reason}`, 302);

      const state = query.state ? decodeState(query.state) : null;
      if (!state || !user || state.userId !== user.id) return fail('state');

      const project = await getProjectById(state.projectId);
      if (!project) return fail('project');
      const back = `${appUrl}/project/${encodeURIComponent(project.key)}/calendar`;
      if (query.error || !query.code) return redirect(`${back}?calendar=denied`, 302);

      try {
        const { tokens, scopes } = await exchangeCode(query.code);
        const email = await fetchAccountEmail(tokens.accessToken);
        await saveConnection(state.projectId, state.userId, email, tokens, scopes);
        return redirect(`${back}?calendar=connected`, 302);
      } catch {
        return redirect(`${back}?calendar=failed`, 302);
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String({ maxLength: 2048 })),
        state: t.Optional(t.String({ maxLength: 2048 })),
        error: t.Optional(t.String({ maxLength: 200 })),
        scope: t.Optional(t.String({ maxLength: 2048 })),
        authuser: t.Optional(t.String({ maxLength: 40 })),
        prompt: t.Optional(t.String({ maxLength: 40 })),
      }),
      detail: { summary: 'Google OAuth callback for the calendar' },
    },
  )

  .delete(
    '/projects/:projectKey/calendar/connection',
    async ({ project, user }) => {
      const userId = requireUserId(user);
      const refreshToken = await takeRefreshToken(project.id, userId);
      // Revoked at Google as well, so disconnecting here also withdraws the grant.
      if (refreshToken) await revokeToken(refreshToken);
      await deleteConnection(project.id, userId);
      return noContent();
    },
    {
      params: projectParams,
      permission: ['calendar', 'edit'],
      response: { 204: t.Void(), 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Disconnect the Google Calendar' },
    },
  )

  .get(
    '/projects/:projectKey/calendar/calendars',
    async ({ project, user }) => listCalendars(await tokenFor(project.id, requireUserId(user))),
    {
      params: projectParams,
      permission: ['calendar', 'read'],
      response: {
        200: t.Array(CalendarResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'List the calendars of the connected account' },
    },
  )

  .put(
    '/projects/:projectKey/calendar/hidden',
    async ({ project, user, body }) => {
      await setHiddenCalendars(project.id, requireUserId(user), body.hiddenCalendarIds);
      return noContent();
    },
    {
      params: projectParams,
      body: t.Object({
        hiddenCalendarIds: t.Array(t.String({ maxLength: 320 }), { maxItems: 250 }),
      }),
      permission: ['calendar', 'edit'],
      response: { 204: t.Void(), 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Set which calendars are hidden in the view' },
    },
  )

  // Every visible calendar is read for the window the view asks for. Google is the
  // only store: nothing is cached here, so what the page shows is what the account
  // holds at that moment.
  .get(
    '/projects/:projectKey/calendar/events',
    async ({ project, user, query }) => {
      const userId = requireUserId(user);
      const connection = await getConnection(project.id, userId);
      if (!connection) throw new HttpError(409, 'No Google Calendar is connected');

      const token = await tokenFor(project.id, userId);
      const hidden = new Set(connection.hiddenCalendarIds);
      const calendars = (await listCalendars(token)).filter((item) => !hidden.has(item.id));
      const perCalendar = await Promise.all(
        calendars.map((item) => listEvents(token, item.id, query.from, query.to)),
      );
      return perCalendar
        .flat()
        .sort((a: GoogleEvent, b: GoogleEvent) => a.start.localeCompare(b.start));
    },
    {
      params: projectParams,
      query: t.Object({
        from: t.String({ minLength: 4, maxLength: 40 }),
        to: t.String({ minLength: 4, maxLength: 40 }),
      }),
      permission: ['calendar', 'read'],
      response: {
        200: t.Array(EventResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'List events in a window' },
    },
  )

  .post(
    '/projects/:projectKey/calendar/events',
    async ({ project, user, body }) => {
      // The draft is built first, so a window that makes no sense is refused here
      // rather than by Google.
      const draft = toDraft(body);
      return insertEvent(await tokenFor(project.id, requireUserId(user)), body.calendarId, draft);
    },
    {
      params: projectParams,
      body: t.Object({ calendarId: t.String({ minLength: 1, maxLength: 320 }), ...DraftBody }),
      permission: ['calendar', 'create'],
      response: {
        200: EventResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Create an event' },
    },
  )

  .patch(
    '/projects/:projectKey/calendar/events/:eventId',
    async ({ project, user, params, body }) => {
      const draft = toDraft(body);
      return patchEvent(
        await tokenFor(project.id, requireUserId(user)),
        body.calendarId,
        params.eventId,
        draft,
      );
    },
    {
      params: t.Object({ projectKey: t.String(), eventId: t.String({ maxLength: 1024 }) }),
      body: t.Object({ calendarId: t.String({ minLength: 1, maxLength: 320 }), ...DraftBody }),
      permission: ['calendar', 'edit'],
      response: {
        200: EventResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Change an event' },
    },
  )

  .delete(
    '/projects/:projectKey/calendar/events/:eventId',
    async ({ project, user, params, query }) => {
      await removeEvent(
        await tokenFor(project.id, requireUserId(user)),
        query.calendarId,
        params.eventId,
      );
      return noContent();
    },
    {
      params: t.Object({ projectKey: t.String(), eventId: t.String({ maxLength: 1024 }) }),
      query: t.Object({ calendarId: t.String({ minLength: 1, maxLength: 320 }) }),
      permission: ['calendar', 'delete'],
      response: {
        204: t.Void(),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Delete an event' },
    },
  );
