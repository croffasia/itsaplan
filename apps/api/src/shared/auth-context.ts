import { Elysia } from 'elysia';
import { db } from '@repo/db';
import { user as users } from '@repo/db/schema';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import {
  auth,
  ensurePersonalWorkspace,
  getSessionFromHeaders,
  isAccountDeactivated,
  verifyMcpAccessToken,
} from '@repo/auth';
import { HttpError } from './lib';
import { getMcpOAuthToken } from './mcp-request';

// GET routes that need no session. The raw attachment and avatar bytes routes
// must work in <img>/<video> and external fetches. The invite lookup
// (`GET /invites/:token`) renders the accept screen for a logged-out invitee, who
// signs up from there; only accept/reject (POST) require a session. Every `/share/`
// GET renders a public read-only shared issue or view, keyed by an unguessable
// token. All ids are unguessable.
const PUBLIC_GET =
  /^\/attachments\/[^/]+\/raw$|^\/chat-attachments\/[^/]+\/raw$|^\/initiative-attachments\/[^/]+\/raw$|^\/avatars\/[^/]+\/raw$|^\/invites\/[^/]+$|^\/share\//;

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
//
// A deactivated account is refused here as well as at sign-in: deactivation arrives
// over SCIM while sessions and API keys are already open, and this is the one place
// every planner route and the MCP surface pass through.
export const authContext = new Elysia({ name: 'auth-context' }).resolve(
  { as: 'scoped' },
  async ({ request, path }): Promise<{ user: SessionUser | null }> => {
    const user = await requestUser(request);
    if (user) return { user: await signedIn(user) };
    // The public raw-attachment route has no session and needs none.
    if (request.method === 'GET' && PUBLIC_GET.test(path)) return { user: null };
    throw new HttpError(401, 'Authentication required');
  },
);

// The account the request's credentials belong to: a session or an API key, or the MCP
// OAuth token of a tool call, which reaches the route beside the request rather than in
// its headers. Whether the account may act is left to the caller.
export async function requestUser(request: Request): Promise<SessionUser | null> {
  const session = await getSessionFromHeaders(request.headers);
  if (session) return session.user;
  const mcpToken = getMcpOAuthToken(request);
  const mcpUserId = mcpToken ? await verifyMcpAccessToken(mcpToken) : null;
  if (!mcpUserId) return null;
  const user = await db.query.user.findFirst({ where: eq(users.id, mcpUserId) });
  return (user as SessionUser | undefined) ?? null;
}

// A deactivated account goes no further. Any other gets its personal workspace here when
// it has none yet, so one made before personal workspaces, by SCIM or while they were off
// has it on its next request instead of its next sign-in.
async function signedIn(user: SessionUser): Promise<SessionUser> {
  if (isAccountDeactivated(user)) throw new HttpError(401, 'This account is deactivated');
  await ensurePersonalWorkspace(user);
  await noteSeen(user.id);
  return user;
}

// god's "Last seen" is good to the hour, so a person's use is written at most once an
// hour: the memo spares the query, and the condition keeps several api replicas from
// writing it each.
const SEEN_EVERY_MS = 60 * 60 * 1000;
const lastNoted = new Map<string, number>();

async function noteSeen(userId: string): Promise<void> {
  const now = Date.now();
  if ((lastNoted.get(userId) ?? 0) > now - SEEN_EVERY_MS) return;
  lastNoted.set(userId, now);
  const due = new Date(now - SEEN_EVERY_MS);
  try {
    await db
      .update(users)
      .set({ lastSeenAt: new Date(now) })
      .where(and(eq(users.id, userId), or(isNull(users.lastSeenAt), lt(users.lastSeenAt, due))));
  } catch (error) {
    // Forgotten so the next request tries again, rather than an hour later.
    lastNoted.delete(userId);
    console.error('[auth] could not note when a person was last seen:', error);
  }
}
