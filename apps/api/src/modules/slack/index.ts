import { Elysia, t } from 'elysia';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { noContent } from '#shared/http';
import { errors } from '#shared/responses';
import { SlackAccountResponse, SlackLinkCompleteBody, SlackLinkStartResponse } from './model';
import { completeSlackLink, getSlackAccounts, startSlackLink, unlinkSlack } from './service';

// The session user's own Slack connections, one per Slack workspace their projects send
// to. Every route is self-scoped. The app itself is set up in god mode and per workspace.
export const slackRoutes = new Elysia({ name: 'slack', detail: { tags: ['Slack'] } })
  .use(authContext)

  .get('/slack/accounts', ({ user }) => getSlackAccounts(requireUser(user).id), {
    response: { 200: t.Array(SlackAccountResponse), ...errors(401) },
    detail: {
      summary: 'List connected Slack accounts',
      description:
        "The Slack workspaces the session user's projects send to and those the user is connected to, with their account in each.",
    },
  })

  .post(
    '/slack/accounts/:slackTeamId/link',
    async ({ params, user }) => ({
      url: await startSlackLink(requireUser(user).id, params.slackTeamId),
    }),
    {
      response: { 200: SlackLinkStartResponse, ...errors(401, 404) },
      detail: {
        summary: 'Start connecting a Slack account',
        description: 'Returns the Sign in with Slack address that completes the connection.',
      },
    },
  )

  .delete(
    '/slack/accounts/:slackTeamId',
    async ({ params, user }) => {
      await unlinkSlack(requireUser(user).id, params.slackTeamId);
      return noContent();
    },
    {
      response: { 204: t.Void(), ...errors(401) },
      detail: { summary: 'Disconnect a Slack account' },
    },
  )

  .post(
    '/slack/accounts/complete',
    async ({ user, body }) => {
      await completeSlackLink(requireUser(user).id, body.code, body.state);
      return noContent();
    },
    {
      body: SlackLinkCompleteBody,
      response: { 204: t.Void(), ...errors(400, 401, 404, 409) },
      detail: {
        summary: 'Complete connecting a Slack account',
        description: 'Takes the code and state Slack sent back to the redirect URL.',
      },
    },
  );
