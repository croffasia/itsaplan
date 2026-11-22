import { Elysia, t } from 'elysia';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { requireUser } from '#shared/access';
import { noContent } from '#shared/http';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import {
  SlackAccountResponse,
  SlackLinkCompleteBody,
  SlackLinkCompleteResponse,
  SlackLinkStartResponse,
} from './model';
import { completeSlackLink, getSlackAccount, startSlackLink, unlinkSlack } from './service';

// The session user's own Slack connection for a project: the Slack account its
// notifications go to, in the Slack workspace of the app that serves the project. Every
// route is self-scoped. The app itself is set up in god mode and per workspace.
export const slackRoutes = new Elysia({ name: 'slack', detail: { tags: ['Slack'] } })
  .use(authContext)
  .use(guards)

  .get(
    '/projects/:projectKey/slack/account',
    ({ project, user }) => getSlackAccount(requireUser(user).id, project.id),
    {
      projectMember: true,
      response: { 200: SlackAccountResponse, ...accessErrors },
      detail: {
        summary: 'Get the connected Slack account',
        description:
          "The Slack workspace the project's notifications go to (null while Slack is off for it), and the session user's account there.",
      },
    },
  )

  .post(
    '/projects/:projectKey/slack/account/link',
    async ({ project, user }) => ({ url: await startSlackLink(requireUser(user).id, project.id) }),
    {
      projectMember: true,
      response: { 200: SlackLinkStartResponse, ...commonErrors },
      detail: {
        summary: 'Start connecting a Slack account',
        description: 'Returns the Sign in with Slack address that completes the connection.',
      },
    },
  )

  .delete(
    '/projects/:projectKey/slack/account',
    async ({ project, user }) => {
      await unlinkSlack(requireUser(user).id, project.id);
      return noContent();
    },
    {
      projectMember: true,
      response: { 204: t.Void(), ...accessErrors },
      detail: { summary: 'Disconnect the Slack account' },
    },
  )

  .post(
    '/slack/account/complete',
    async ({ user, body }) => ({
      projectRef: await completeSlackLink(requireUser(user).id, body.code, body.state),
    }),
    {
      body: SlackLinkCompleteBody,
      response: { 200: SlackLinkCompleteResponse, ...errors(400, 401, 404, 409) },
      detail: {
        summary: 'Complete connecting a Slack account',
        description: 'Takes the code and state Slack sent back to the redirect URL.',
      },
    },
  );
