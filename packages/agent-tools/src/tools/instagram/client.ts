import type { GraphApiResponse, ToolConfig } from '../../types';
import { sleep } from '../time';

// Shared client for the Instagram Platform API (Instagram API with Facebook
// Login), served from the Facebook Graph API host. Every tool authenticates with
// the credential's long-lived access token and, where an endpoint acts on "our"
// account, its Instagram Business/Creator user id.
//
// One credential is one Instagram account: the access token plus the ig_user_id it
// belongs to. Tools that address arbitrary media/comment ids take those ids as
// model input; the account id and token always come from the credential.

const IG_BASE = 'https://graph.facebook.com/v25.0';

// Reads the access token and account id off a decrypted credential.
export function creds(credential: ToolConfig): { token: string; igUserId: string } {
  return { token: String(credential.accessToken), igUserId: String(credential.igUserId) };
}

// Calls a Graph API node. GET/DELETE put params in the query string, POST sends a
// form body; the access token is added automatically. Null and undefined params
// are dropped. Throws a clear Error on a transport or API-level failure (the Graph
// API returns errors in `body.error`, sometimes with a 200 status), so the runtime
// surfaces the message to the model.
export async function igRequest(
  token: string,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, unknown> = {},
): Promise<GraphApiResponse> {
  const url = new URL(`${IG_BASE}/${path}`);
  const withToken = { ...params, access_token: token };
  const init: RequestInit = { method };
  if (method === 'POST') {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(withToken)) if (v != null) form.set(k, String(v));
    init.body = form;
  } else {
    for (const [k, v] of Object.entries(withToken))
      if (v != null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, init);
  const raw = await res.text();
  let body: GraphApiResponse = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    // Non-JSON error page: fall through to the status check below.
  }
  if (!res.ok || body.error) {
    const msg = body.error?.error_user_msg || body.error?.message || `HTTP ${res.status}`;
    throw new Error(`Instagram API error: ${msg}`);
  }
  return body;
}

// Polls a media container until it is FINISHED (ready to publish) or fails with
// ERROR/EXPIRED. A definitive container error aborts at once; a read error is
// treated as transient and polling continues. Gives up after ~60s: a container
// still processing returns so the caller can try to publish anyway, but when every
// read failed the last error is thrown instead, so a bad token or id surfaces
// rather than being swallowed.
export async function waitForContainer(creationId: string, token: string): Promise<void> {
  let lastError: unknown = null;
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    try {
      const st = await igRequest(token, 'GET', creationId, { fields: 'status_code' });
      lastError = null;
      if (st.status_code === 'FINISHED' || st.status_code === 'PUBLISHED') return;
      if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') {
        throw new Error(`Instagram container ${String(st.status_code)}`);
      }
    } catch (err) {
      if (err instanceof Error && /container (ERROR|EXPIRED)/.test(err.message)) throw err;
      lastError = err;
    }
  }
  if (lastError) throw lastError;
}
