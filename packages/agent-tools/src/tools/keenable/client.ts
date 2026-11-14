import type { ToolConfig } from '../../types';
import { jsonOrThrow } from '../../http';

export const KEENABLE_BASE = 'https://api.keenable.ai/v1';

export function keenableAuth(credential: ToolConfig): Record<string, string> {
  return credential.apiKey
    ? { 'X-API-Key': String(credential.apiKey) }
    : // The public endpoints answer 400 to a call that does not name its app.
      { 'X-Keenable-Title': 'itsaplan' };
}

// With an API key a call goes to the keyed endpoint. Without one it goes to the public
// endpoint, which is limited per IP address.
export async function keenableRequest(
  credential: ToolConfig,
  endpoint: 'search' | 'fetch',
  request: { body: Record<string, unknown> } | { params: Record<string, string> },
  what: string,
): Promise<unknown> {
  const url = `${KEENABLE_BASE}/${credential.apiKey ? endpoint : `${endpoint}/public`}`;
  const post = 'body' in request;
  const res = await fetch(post ? url : `${url}?${new URLSearchParams(request.params)}`, {
    method: post ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      ...keenableAuth(credential),
      ...(post ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(post ? { body: JSON.stringify(request.body) } : {}),
  });
  return jsonOrThrow(res, what);
}
