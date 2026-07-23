import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// Routes reachable without a session, and that bounce a signed-in user back to
// the app. Everything else requires one.
const PUBLIC_PATHS = ['/login', '/register'];

// Routes reachable with or without a session, and never bounced. The invite
// accept page must open for a logged-out invitee (who registers there) and for a
// logged-in one (who accepts directly). The password screens are here for the same
// reason: a reset link opened in a browser that still holds a session must show the
// form, not bounce to the app. The public read-only share pages (/share/*) open for
// anyone with the link, signed in or not.
const OPEN_PATHS = ['/invite', '/forgot-password', '/reset-password', '/share'];

// Gate the whole app behind a session. This is an optimistic check: it only looks
// for the presence of the better-auth session cookie, not its validity — the API
// does the real validation on every request. It keeps unauthenticated users out of
// the planner UI and bounces signed-in users away from the auth pages.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = getSessionCookie(request) != null;
  const matches = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  if (OPEN_PATHS.some(matches)) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some(matches);

  if (isPublic) {
    if (hasSession) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on every route except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
