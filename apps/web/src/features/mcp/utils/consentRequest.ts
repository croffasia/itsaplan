// The consent page's URL carries the authorization request better-auth signed: which
// client asks, and where the answer is sent. The client picks its own name when it
// registers, so the redirect is what tells the person where access really goes.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export type ConsentRedirect = {
  // The host of a web callback, or the scheme of an app's own one (`cursor://`).
  label: string;
  local: boolean;
};

function redirectOf(raw: string | null): ConsentRedirect | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { label: `${url.protocol}//`, local: true };
  }
  return url.host ? { label: url.host, local: LOOPBACK_HOSTS.has(url.hostname) } : null;
}

export function consentRequest(params: URLSearchParams): {
  clientId: string | null;
  redirect: ConsentRedirect | null;
} {
  return { clientId: params.get('client_id'), redirect: redirectOf(params.get('redirect_uri')) };
}
