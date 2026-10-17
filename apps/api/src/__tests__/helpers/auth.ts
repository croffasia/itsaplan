import { createHash } from 'node:crypto';
import { auth } from '@repo/auth';
import { db, workspaceManager } from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { insertOwnedTeam } from '#modules/teams/service';
import { app } from './app';

export interface TestUser {
  // The session cookie header to pass to authenticated requests, e.g.
  // authedApi(cookie) or a per-call { headers: { cookie } }.
  cookie: string;
  userId: string;
  email: string;
  // The handle the sign-up hook derived from the address, which is how a test
  // mentions this user.
  username: string;
  // The workspace sign-up gave the account, or null when it got none (personal
  // workspaces off, and not the instance owner).
  workspaceId: number | null;
}

let counter = 0;

// Registers a new user through better-auth and returns their session cookie.
// autoSignIn is on in the auth config, so sign-up already establishes a session;
// we read the Set-Cookie off the response. Each call uses a unique email so
// tests do not collide. Pass this cookie to authenticated requests.
//
// Sign-up creates no team. Most tests need one to create projects in, so the user is
// given a team named after its username, without a slug, in its own workspace, unless
// `team` is false.
//
// Note: the very first user created in a fresh database becomes the "god" role
// (better-auth create hook). resetDb() clears users between tests, so whichever
// user a test creates first is "god" — keep that in mind for role-sensitive tests.
export async function signUpTestUser(
  overrides: { email?: string; password?: string; name?: string; team?: boolean } = {},
): Promise<TestUser> {
  counter += 1;
  const email = overrides.email ?? `test-user-${counter}@example.com`;
  const password = overrides.password ?? 'test-password-123';
  const name = overrides.name ?? `Test User ${counter}`;

  const response = await auth.api.signUpEmail({
    body: { email, password, name },
    asResponse: true,
  });

  const setCookies = response.headers.getSetCookie();
  if (setCookies.length === 0) {
    throw new Error(
      `signUpTestUser: no Set-Cookie returned for ${email} (status ${response.status})`,
    );
  }
  // Turn each "name=value; Path=/; HttpOnly; ..." into "name=value" and join
  // them into a single Cookie header.
  const cookie = setCookies.map((c) => c.split(';')[0]).join('; ');

  const body = (await response.json()) as { user?: { id?: string; username?: string } };
  const userId = body.user?.id;
  if (!userId) throw new Error(`signUpTestUser: no user id returned for ${email}`);
  const username = body.user?.username;
  if (!username) throw new Error(`signUpTestUser: no username returned for ${email}`);
  const [own] = await db
    .select({ workspaceId: workspaceManager.workspaceId })
    .from(workspaceManager)
    .where(and(eq(workspaceManager.userId, userId), eq(workspaceManager.role, 'owner')));
  const workspaceId = own?.workspaceId ?? null;
  if (overrides.team !== false) {
    if (workspaceId === null) {
      throw new Error(`signUpTestUser: ${email} has no workspace for a team; pass team: false`);
    }
    await db.transaction(async (tx) => insertOwnedTeam(tx, workspaceId, username, userId));
  }

  return { cookie, userId, email, username, workspaceId };
}

// Opens a magic link for `email` as the web asks for one (errorCallbackURL on the sign-in
// page) and returns where it redirects. The token is written straight into the
// verification table, as better-auth stores it (`storeToken: 'hashed'`), because the
// real one only travels in the email.
export async function openMagicLink(email: string, token: string): Promise<URL> {
  const context = await auth.$context;
  await context.internalAdapter.createVerificationValue({
    identifier: `magic-link:${createHash('sha256').update(token).digest('base64url')}`,
    value: JSON.stringify({ type: 'magic-link', email }),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const res = await app.handle(
    new Request(
      `http://localhost/api/auth/magic-link/verify?token=${token}&callbackURL=/&errorCallbackURL=/login`,
    ),
  );
  if (res.status !== 302) throw new Error(`magic link answered ${res.status}`);
  return new URL(res.headers.get('location') ?? '', 'http://localhost');
}
