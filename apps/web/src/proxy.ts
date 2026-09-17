import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { contentSecurityPolicy } from '@/utils/contentSecurityPolicy';

// Routes reachable without a session, and that bounce a signed-in user back to
// the app. Everything else requires one.
const PUBLIC_PATHS = ['/login', '/register'];

// Routes reachable with or without a session, and never bounced. The invite
// accept page must open for a logged-out invitee (who registers there) and for a
// logged-in one (who accepts directly). The password screens are here for the same
// reason: a reset link opened in a browser that still holds a session must show the
// form, not bounce to the app. The public read-only share pages (/share/*) open for
// anyone with the link, signed in or not.
// `/media` streams avatars and attachments from the api, which serves them without
// a session — a share page opened by a logged-out visitor shows them too.
// `/protected-media` is intentionally absent: document assets carry private project
// content and must pass this session gate before their route forwards the cookie.
const OPEN_PATHS = ['/invite', '/forgot-password', '/reset-password', '/share', '/media'];

// Routes that stream bytes from the api and pass its headers through, including the
// sandbox policy it puts on a download. The document policy is for html only, and set
// here it would replace the api's.
const MEDIA_PATHS = ['/media', '/protected-media'];

function matcher(pathname: string) {
  return (path: string) => pathname === path || pathname.startsWith(`${path}/`);
}

// Expires every better-auth cookie the request carries. A `__Secure-` name is only
// accepted back with `secure`, so the deletion carries it too.
function clearSession(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  for (const { name } of request.cookies.getAll()) {
    if (!name.includes('better-auth.')) continue;
    response.cookies.delete({ name, path: '/', secure: name.startsWith('__Secure-') });
  }
  return response;
}

export function proxy(request: NextRequest) {
  const response = gate(request);
  if (!MEDIA_PATHS.some(matcher(request.nextUrl.pathname))) {
    response.headers.set('Content-Security-Policy', contentSecurityPolicy());
  }
  return response;
}

// Gate the whole app behind a session. This is an optimistic check: it only looks
// for the presence of the better-auth session cookie, not its validity — the API
// does the real validation on every request. It keeps unauthenticated users out of
// the planner UI and bounces signed-in users away from the auth pages.
// A cookie the API no longer accepts passes this check, so the client handles that
// case: `apiFailure` in `lib/api/core/client.ts` signs out on a 401 and lands on
// `/login?expired=1`, where the cookie is cleared for good.
function gate(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = getSessionCookie(request) != null;
  const matches = matcher(pathname);

  if (OPEN_PATHS.some(matches)) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some(matches);

  if (isPublic) {
    // The client lands here after the API refused the session. Its sign-out misses a
    // cookie written under attributes the api no longer sets, and that one passes the
    // check below and bounces the browser back into the app, where the next 401 starts
    // the cycle over.
    if (request.nextUrl.searchParams.get('expired') === '1') return clearSession(request);
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
  // Protected media is listed first so a valid project key containing a dot is
  // still session-gated instead of falling through the static-file exclusion.
  matcher: ['/protected-media/:path*', '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
