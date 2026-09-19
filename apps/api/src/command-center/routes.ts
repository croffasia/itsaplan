import { Elysia, t } from 'elysia';
import { guards } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { noContent } from '../shared/http';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { mcpTool } from '../mcp/generate';
import { clearSnooze, getCommandCenter, snoozeSignal } from './store';

const projectParams = t.Object({ projectKey: t.String() });
const signalParams = t.Object({ projectKey: t.String(), signalId: t.String({ maxLength: 60 }) });

const SignalResponse = t.Object({
  id: t.String(),
  severity: t.Union([t.Literal('critical'), t.Literal('attention'), t.Literal('info')]),
  title: t.String(),
  detail: t.String(),
  count: t.Number(),
  href: t.String(),
  resource: t.String(),
  snoozedUntil: t.Nullable(t.String()),
});

const CommandCenterResponse = t.Object({
  generatedAt: t.String(),
  signals: t.Array(SignalResponse),
  focusId: t.Nullable(t.String()),
});

const MAX_SNOOZE_HOURS = 7 * 24;

function requireUserId(user: { id: string } | null | undefined): string {
  if (!user) throw new HttpError(401, 'Authentication required');
  return user.id;
}

// The start page: what wants attention across every section, derived on each read.
// It is gated on project access rather than one resource, because each signal
// carries its own: a member only sees what their role already lets them read.
export const commandCenterRoutes = new Elysia({
  name: 'command-center',
  detail: { tags: ['Command Center'] },
})
  .use(authContext)
  .use(guards)

  .get(
    '/projects/:projectKey/command-center',
    async ({ project, user }) => getCommandCenter(project.id, project.key, requireUserId(user)),
    {
      params: projectParams,
      projectMember: true,
      response: {
        200: CommandCenterResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'What needs attention in this project today',
        description:
          'The command centre: overdue work, blocked items, overdue invoices, failed agent ' +
          'runs, refused server connections and unread alerts, each with where to act on it. ' +
          'Only signals the caller may read are returned.',
        ...mcpTool('get_command_center'),
      },
    },
  )

  // Pushing a signal away is per member: it changes what this page shows them, not
  // what anyone else sees, and never the underlying work.
  .post(
    '/projects/:projectKey/command-center/:signalId/snooze',
    async ({ project, user, params, body }) => {
      const hours = body.hours ?? 24;
      if (hours < 1 || hours > MAX_SNOOZE_HOURS) {
        throw new HttpError(400, 'A signal can be snoozed for between an hour and a week');
      }
      await snoozeSignal(
        project.id,
        requireUserId(user),
        params.signalId,
        new Date(Date.now() + hours * 3600_000),
      );
      return noContent();
    },
    {
      params: signalParams,
      body: t.Object({ hours: t.Optional(t.Number()) }),
      projectMember: true,
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Hide a signal until later' },
    },
  )

  .delete(
    '/projects/:projectKey/command-center/:signalId/snooze',
    async ({ project, user, params }) => {
      await clearSnooze(project.id, requireUserId(user), params.signalId);
      return noContent();
    },
    {
      params: signalParams,
      projectMember: true,
      response: { 204: t.Void(), 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Bring a snoozed signal back' },
    },
  );
