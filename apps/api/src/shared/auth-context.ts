import { Elysia } from 'elysia';
import { auth } from '@repo/auth';
import { HttpError } from './lib';

// GET routes that need no session. The raw attachment and avatar bytes routes
// must work in <img>/<video> and external fetches. The invite lookup
// (`GET /invites/:token`) renders the accept screen for a logged-out invitee, who
// signs up from there; only accept/reject (POST) require a session. All ids are
// unguessable.
const PUBLIC_GET = /^\/attachments\/[^/]+\/raw$|^\/avatars\/[^/]+\/raw$|^\/invites\/[^/]+$/;

type SessionResult = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

// The authenticated user carried on the request context.
export type SessionUser = SessionResult['user'];

// Session plugin shared by the planner. Resolves the better-auth session once and
// puts `user` on the context, so handlers and the access guards read it instead
// of calling getSession again. A missing session is a 401, except on the public
// raw-attachment route, which carries no user.
//
// planner.ts uses this as the runtime backstop, so every planner route is
// session-gated. A feature also uses it directly when its handlers or local
// macros reference `user`, which is what makes the `user` type flow there. The
// plugin is named, so its resolve runs once per request (dedup).
export const authContext = new Elysia({ name: 'auth-context' }).resolve(
  { as: 'scoped' },
  async ({ request, path }): Promise<{ user: SessionUser | null }> => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session) return { user: session.user };
    // The public raw-attachment route has no session and needs none.
    if (request.method === 'GET' && PUBLIC_GET.test(path)) return { user: null };
    throw new HttpError(401, 'Authentication required');
  },
);
