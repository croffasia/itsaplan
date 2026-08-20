import type { ToolConfig } from '../../types';
import { sleep } from '../time';

// Notion REST API client. Every tool authenticates with the credential's integration
// token and pins the API version these request shapes were written against.
//
// Notion answers a burst from one connection with 429, and an overloaded workspace
// with 529; both carry a Retry-After delay. The client waits and repeats the call, so
// a rate limit slows a run down instead of failing it.

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2026-03-11';
const RETRY_STATUSES = new Set([429, 529]);
const RETRIES = 5;
const FALLBACK_RETRY_MS = 1000;

export interface NotionResponse {
  results?: Record<string, unknown>[];
  code?: string;
  message?: string;
  [key: string]: unknown;
}

export function notionToken(credential: ToolConfig): string {
  const token = credential.token ? String(credential.token) : '';
  if (!token) throw new Error('No Notion token configured.');
  return token;
}

// The bare id of a page or block. A model passes an id with or without dashes, or the
// page URL it was given, so all three are accepted.
export function notionId(raw: unknown, what = 'page'): string {
  const value = String(raw ?? '').trim();
  const match = value.match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i);
  if (!match) throw new Error(`"${value}" is not a Notion ${what} id or URL.`);
  return match[0].replace(/-/g, '');
}

// The Notion capability a call needs, derived from the endpoint, so a rejected call
// names the permission to grant on the integration.
function capabilityFor(method: string, path: string): string {
  if (path.startsWith('comments')) return method === 'GET' ? 'Read comments' : 'Insert comments';
  if (method === 'GET' || path.startsWith('search')) return 'Read content';
  if (path === 'pages') return 'Insert content';
  return 'Update content';
}

// Turns a Notion error body into a message the agent can act on: the two failures a
// token runs into (a page nobody shared with it, a capability nobody granted it) name
// what to change in Notion instead of reading as "not found".
function explain(status: number, body: NotionResponse, capability: string): string {
  const detail = body.message ? `: ${body.message}` : '';
  switch (body.code) {
    case 'object_not_found':
      return `Notion cannot see this page. Share it with the integration in Notion (open the page, "..." menu, Connections, add the connection)${detail}`;
    case 'restricted_resource':
      return `The Notion token is missing the "${capability}" capability. Grant it to the integration in Notion, then retry${detail}`;
    case 'unauthorized':
      return `The Notion token is invalid or was revoked${detail}`;
    case 'rate_limited':
    case 'service_overload':
      return `Notion is still throttling this connection after ${RETRIES} retries${detail}`;
    default:
      return `Notion API error (${status})${detail}`;
  }
}

// How long to wait before repeating a throttled call. Notion sends the delay in
// Retry-After (seconds); without it the wait doubles per attempt, with jitter so
// several parallel tool calls do not retry in the same instant.
function retryDelayMs(res: Response, attempt: number): number {
  const header = Number(res.headers.get('retry-after'));
  if (header > 0) return header * 1000;
  return FALLBACK_RETRY_MS * 2 ** attempt * (1 + Math.random());
}

// Calls a Notion endpoint and returns its parsed body. `path` is everything after
// /v1/, query string included.
export async function notionRequest(
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<NotionResponse> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${NOTION_BASE}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (RETRY_STATUSES.has(res.status) && attempt < RETRIES) {
      await sleep(retryDelayMs(res, attempt));
      continue;
    }
    const raw = await res.text();
    let parsed: NotionResponse = {};
    try {
      parsed = raw ? (JSON.parse(raw) as NotionResponse) : {};
    } catch {
      /* non-JSON error page */
    }
    if (!res.ok) throw new Error(explain(res.status, parsed, capabilityFor(method, path)));
    return parsed;
  }
}
