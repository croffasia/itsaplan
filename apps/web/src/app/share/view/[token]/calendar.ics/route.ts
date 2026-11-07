import { serverRuntimeEnv } from '@/utils/runtimeEnv';

// The calendar feed for a public shared view. Calendar apps subscribe to the web
// origin, so the api's public feed is served through here like the share pages.
// The token is the only credential; no request header is forwarded.
const SHARE_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// No request data marks the handler dynamic, so state it; otherwise Next tries to
// render the feed once at build time and the fetch throws.
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!SHARE_TOKEN.test(token)) return new Response(null, { status: 404 });

  const origin = process.env.SERVICE_URL_API || serverRuntimeEnv().apiUrl;
  const upstream = await fetch(`${origin}/share/view/${token}/calendar.ics`, {
    cache: 'no-store',
    redirect: 'error',
  });

  const headers = new Headers();
  for (const name of ['content-type', 'cache-control']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
