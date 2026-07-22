import { auth } from '@repo/auth';

export interface TestUser {
  // The session cookie header to pass to authenticated requests, e.g.
  // authedApi(cookie) or a per-call { headers: { cookie } }.
  cookie: string;
  userId: string;
  email: string;
}

let counter = 0;

// Registers a new user through better-auth and returns their session cookie.
// autoSignIn is on in the auth config, so sign-up already establishes a session;
// we read the Set-Cookie off the response. Each call uses a unique email so
// tests do not collide. Pass this cookie to authenticated requests.
//
// Note: the very first user created in a fresh database becomes the "god" role
// (better-auth create hook). resetDb() clears users between tests, so whichever
// user a test creates first is "god" — keep that in mind for role-sensitive tests.
export async function signUpTestUser(
  overrides: { email?: string; password?: string; name?: string } = {},
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

  const body = (await response.json()) as { user?: { id?: string } };
  const userId = body.user?.id;
  if (!userId) throw new Error(`signUpTestUser: no user id returned for ${email}`);

  return { cookie, userId, email };
}
