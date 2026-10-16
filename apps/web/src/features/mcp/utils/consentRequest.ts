// The consent page's URL carries the authorization request better-auth signed: which
// client asks, and where the answer is sent. The client picks its own name when it
// registers, so the redirect host is what tells the person where access really goes.
export function consentRequest(params: URLSearchParams): {
  clientId: string | null;
  redirectHost: string | null;
} {
  const redirect = params.get('redirect_uri');
  let redirectHost: string | null = null;
  if (redirect) {
    try {
      redirectHost = new URL(redirect).host || null;
    } catch {
      redirectHost = null;
    }
  }
  return { clientId: params.get('client_id'), redirectHost };
}
