import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { contentSecurityPolicy } from '@/utils/contentSecurityPolicy';
import { apiProxyTarget } from '@/utils/runtimeEnv';

// Routes reachable without a session, and that bounce a signed-in user back to
// the app. Everything else requires one.
const PUBLIC_PATHS = ['/login', '/register'];

// Routes reachable with or without a session, and never bounced. The invite
// accept page must open for a logged-out invitee (who registers there) and for a
// logged-in one (who accepts directly). The password screens are here for the same
// reason: a reset link opened in a browser that still holds a session must show the
// form, not bounce to the app. The public read-only share pages (/share/*) open for
// anyone with the link, signed in or not. The product page (/product) is public.
// `/media` streams avatars and attachments from the api, which serves them without
// a session — a share page opened by a logged-out visitor shows them too.
// `/protected-media` is intentionally absent: document assets carry private project
// content and must pass this session gate before their route forwards the cookie.
const OPEN_PATHS = [
  '/invite',
  '/forgot-password',
  '/reset-password',
  '/share',
  '/media',
  '/product',
];

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
    // A __Secure- or __Host- name is only accepted back with `secure`.
    const secure = name.startsWith('__Secure-') || name.startsWith('__Host-');
    response.cookies.delete({ name, path: '/', secure });
  }
  return response;
}

// With API_PROXY_TARGET set, the api is served on this origin: the browser's api calls
// are passed through to it. The api's routes share paths with pages (/projects,
// /teams), so a request is told apart by what asks for it: a page load, an RSC fetch
// or a server action goes to Next, a script's fetch or XHR (Sec-Fetch-Dest "empty",
// or no fetch metadata at all) goes to the api. The auth handler always does, since
// its redirects are navigations.
function isApiCall(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) return true;
  if (MEDIA_PATHS.some(matcher(pathname))) return false;
  // Next's own endpoints (the dev server's live-reload socket among them, which a
  // browser sends with Sec-Fetch-Dest "empty") are never the api's.
  if (pathname.startsWith('/_next/') || pathname.startsWith('/__nextjs')) return false;
  if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') return false;
  if (request.headers.has('rsc') || request.headers.has('next-action')) return false;
  const dest = request.headers.get('sec-fetch-dest');
  return dest == null || dest === 'empty';
}

export function proxy(request: NextRequest) {
  const target = apiProxyTarget();
  if (target && isApiCall(request)) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.rewrite(new URL(`${pathname}${search}`, target));
  }
  // A dotted path is matched only for the pass-through above; without it, it is left
  // alone as before.
  const { pathname } = request.nextUrl;
  if (!target && pathname.includes('.') && !matcher(pathname)('/protected-media')) {
    return NextResponse.next();
  }
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
  // Over HTTPS the api names the session cookie with the __Host- prefix, which
  // getSessionCookie only finds when told the prefix.
  const hasSession =
    (getSessionCookie(request) ??
      getSessionCookie(request, { cookiePrefix: '__Host-better-auth' })) != null;
  const matches = matcher(pathname);

  if (OPEN_PATHS.some(matches)) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some(matches);

  if (isPublic) {
    // The client lands here after the API refused the session. Its sign-out misses a
    // cookie written under attributes the api no longer sets, and that one passes the
    // check below and bounces the browser back into the app, where the next 401 starts
    // the cycle over.
    if (request.nextUrl.searchParams.get('expired') === '1') return clearSession(request);
    // An error the api could not hand back to the page that asked (an MCP client it
    // does not know, a provider callback that failed) has only this screen to say so.
    const showsError = request.nextUrl.searchParams.has('error');
    if (hasSession && !showsError) return NextResponse.redirect(new URL('/', request.url));
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
  // The last entry reaches a script's fetch of any path, a dotted one included
  // (a project ref such as team.KEY), so an api call passed through by
  // API_PROXY_TARGET is not left to the static-file exclusion.
  matcher: [
    '/protected-media/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
    {
      source: '/((?!_next/).*)',
      has: [{ type: 'header', key: 'sec-fetch-dest', value: 'empty' }],
    },
  ],
};
