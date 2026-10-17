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
        'Who you are: the user your key, sign-in or MCP connection acts as. Call it when a ' +
        'request says "me", "my" or "mine" — user.id is the assigneeUserId of your own ' +
        'issues — instead of guessing from a name or an email. user.timezone is the zone ' +
        'to read "today" or "this week" in. Without credentials, or for a deactivated ' +
        'account, it answers `{ authenticated: false }` instead of failing.',
      ...mcpTool('get_current_user'),
    },
  },
);
