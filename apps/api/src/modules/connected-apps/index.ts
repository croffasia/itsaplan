import { Elysia, t } from 'elysia';
import { requireBrowserSession, requireUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { errors } from '#shared/responses';
import { ConnectedApp, ConnectedAppParams } from './model';
import { listConnectedApps, revokeConnectedApp } from './service';

// The OAuth applications (MCP clients such as Claude or ChatGPT) the session user let
// act on their behalf, and the way to cut one off.
export const connectedAppRoutes = new Elysia({
  name: 'connected-apps',
  detail: { tags: ['Settings'] },
})
  .use(authContext)
  // An agent's key must not see the other grants, or lift the revocation of one by
  // revoking the rest.
  .onBeforeHandle(({ request }) => {
    requireBrowserSession(request, 'Connected applications are managed from a browser session');
  })

  .get('/account/connected-apps', ({ user }) => listConnectedApps(requireUser(user).id), {
    response: { 200: t.Array(ConnectedApp), ...errors(401, 403) },
    detail: {
      summary: 'List connected applications',
      description:
        'List the OAuth applications the current user authorized to act on their behalf.',
    },
  })

  .delete(
    '/account/connected-apps/:clientId',
    async ({ user, params }) => {
      if (!(await revokeConnectedApp(requireUser(user).id, params.clientId))) {
        throw new HttpError(404, 'Application not connected');
      }
      return noContent();
    },
    {
      params: ConnectedAppParams,
      response: { 204: t.Void(), ...errors(401, 403, 404) },
      detail: {
        summary: 'Disconnect an application',
        description:
          "Revoke an application's access: its tokens stop working at once and the next connection asks for consent again.",
      },
    },
  );
