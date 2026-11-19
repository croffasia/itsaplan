import { Elysia } from 'elysia';
import { isAccountDeactivated } from '@repo/auth';
import { requestUser } from '#shared/auth-context';
import { mcpTool } from '#mcp/generate';
import { Me } from './model';
import { getCurrentUser } from './service';

// Mounted on the root app, not under the planner: without credentials it answers
// `{ authenticated: false }`, where the planner's authContext would answer 401.
export const currentUserRoutes = new Elysia({
  name: 'current-user',
  detail: { tags: ['System'] },
}).get(
  '/me',
  async ({ request }) => {
    const account = await requestUser(request);
    // A deactivated account is not signed in as far as the app is concerned: every
    // planner route answers 401 for it. Deactivation arrives over SCIM or from god
    // mode, after the session was opened.
    if (!account || isAccountDeactivated(account)) return { authenticated: false as const };
    return { authenticated: true as const, user: await getCurrentUser(account) };
  },
  {
    response: { 200: Me },
    detail: {
      summary: 'Get the current user',
      description:
        'Get the user your key or session acts as. Use it for "me", "my" or "mine" instead of ' +
        'matching a name or an email. user.id is the assigneeUserId of your issues. Read "today" ' +
        'and "this week" in user.timezone. Without credentials or for a deactivated account, ' +
        'returns `{ authenticated: false }`.',
      ...mcpTool('get_current_user'),
    },
  },
);
