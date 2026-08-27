import { serverRuntimeEnv } from '@/utils/runtimeEnv';

// Avatars and attachments live on the api, on another origin. Serving them through
// the web origin makes them local images for next/image: `images.remotePatterns` is
// frozen into the build, so an absolute api url cannot be optimized by an image that
// has to serve any instance.
//
// Only the api's public, unauthenticated media routes are reachable here, and no
// request header is forwarded — this must never become a way to reach the rest of the
// api through the web server.
const MEDIA_ROOTS = ['avatars', 'attachments', 'chat-attachments'];

// Copied from the api's response, including the headers that keep attacker-controlled
// bytes inert (nosniff, the disposition that forces a download, the sandbox CSP).
const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-disposition',
  'cache-control',
  'etag',
  'x-content-type-options',
  'content-security-policy',
];

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!MEDIA_ROOTS.includes(path[0]) || path.some((segment) => segment === '..')) {
    return new Response(null, { status: 404 });
  }

  // The public origin is what the browser uses; inside a compose network the api is
  // reached by service name, which is what SERVICE_URL_API carries (as for the worker).
  const origin = process.env.SERVICE_URL_API || serverRuntimeEnv().apiUrl;
  const { search } = new URL(request.url);
  const upstream = await fetch(`${origin}/${path.join('/')}${search}`, {
    // The api answers 304 to it, and passing it on keeps a cached avatar cached.
    headers: forwardedHeaders(request),
    cache: 'no-store',
  });

  const headers = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

function forwardedHeaders(request: Request): HeadersInit {
  const ifNoneMatch = request.headers.get('if-none-match');
  return ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {};
}
