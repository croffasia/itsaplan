import type { ToolConfig } from '../../types';
import { sleep } from '../time';

// Microsoft Graph client for a Microsoft 365 tenant. A credential is an Entra ID app
// registration with application permissions (client credentials flow), so the agent
// acts as the app, not as a person: every call names the mailbox, drive or site it
// works on. The default user is the account the mail, calendar and OneDrive tools use
// when the model names none.
//
// Graph answers a burst with 429 and an overloaded service with 503 or 504, all with
// Retry-After. The client waits and repeats the call, so throttling slows a run down
// instead of failing it.

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const RETRY_STATUSES = new Set([429, 503, 504]);
const RETRIES = 4;
const FALLBACK_RETRY_MS = 1000;

export interface GraphResponse {
  value?: Record<string, unknown>[];
  error?: { code?: string; message?: string };
  [key: string]: unknown;
}

export interface Microsoft365Credential {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  defaultUser: string;
}

export function msCredential(credential: ToolConfig): Microsoft365Credential {
  const read = (key: string) => (credential[key] ? String(credential[key]).trim() : '');
  const value = {
    tenantId: read('tenantId'),
    clientId: read('clientId'),
    clientSecret: read('clientSecret'),
    defaultUser: read('defaultUser'),
  };
  if (!value.tenantId || !value.clientId || !value.clientSecret) {
    throw new Error('The Microsoft 365 credential needs a tenant ID, a client ID and a secret.');
  }
  return value;
}

// The user a call acts on: the one the model named, otherwise the credential's
// default. App-only Graph has no "me", so one of them is required.
export function msUser(cred: Microsoft365Credential, raw: unknown): string {
  const user = String(raw ?? '').trim() || cred.defaultUser;
  if (!user) {
    throw new Error(
      'No user given. Pass the user (email address) to act on, or set a default user on the Microsoft 365 credential.',
    );
  }
  return encodeURIComponent(user);
}

// A token lasts about an hour; reusing it spares Entra a sign-in per call.
const tokens = new Map<string, { token: string; expiresAt: number }>();

export function clearTokenCache(): void {
  tokens.clear();
}

async function accessToken(cred: Microsoft365Credential): Promise<string> {
  const cacheKey = `${cred.tenantId}:${cred.clientId}:${cred.clientSecret}`;
  const cached = tokens.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(cred.tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: cred.clientId,
        client_secret: cred.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    const detail = body.error_description?.split('\r\n')[0];
    throw new Error(`Microsoft refused the app credentials${detail ? `: ${detail}` : ''}`);
  }
  tokens.set(cacheKey, {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  });
  return body.access_token;
}

// Turns a Graph error into a message the agent can act on: a missing application
// permission names the permission to grant, instead of reading as "forbidden".
export function explainGraphError(status: number, body: GraphResponse, permission: string): string {
  const detail = body.error?.message ? `: ${body.error.message}` : '';
  if (status === 401) return `Microsoft rejected the app token${detail}`;
  if (status === 403) {
    return `The app is missing the "${permission}" application permission, or admin consent for it. Grant it in Entra ID (App registrations, API permissions), then retry${detail}`;
  }
  if (status === 404) return `Microsoft 365 found nothing at that address${detail}`;
  if (RETRY_STATUSES.has(status))
    return `Microsoft Graph is still throttling after ${RETRIES} retries${detail}`;
  return `Microsoft Graph error (${status})${detail}`;
}

function retryDelayMs(res: Response, attempt: number): number {
  const header = Number(res.headers.get('retry-after'));
  if (header > 0) return Math.min(header, 30) * 1000;
  return FALLBACK_RETRY_MS * 2 ** attempt * (1 + Math.random());
}

export interface GraphRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  // Everything after /v1.0/, query string included.
  path: string;
  // The application permission the call needs, named in a 403.
  permission: string;
  json?: unknown;
  raw?: { body: string; contentType: string };
  headers?: Record<string, string>;
}

async function graphFetch(cred: Microsoft365Credential, req: GraphRequest): Promise<Response> {
  const token = await accessToken(cred);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${GRAPH_BASE}/${req.path}`, {
      method: req.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(req.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(req.raw ? { 'Content-Type': req.raw.contentType } : {}),
        ...req.headers,
      },
      body: req.json !== undefined ? JSON.stringify(req.json) : req.raw?.body,
    });
    if (RETRY_STATUSES.has(res.status) && attempt < RETRIES) {
      await sleep(retryDelayMs(res, attempt));
      continue;
    }
    return res;
  }
}

// Calls a Graph endpoint and returns its parsed JSON body ({} for an empty answer).
export async function graphRequest(
  cred: Microsoft365Credential,
  req: GraphRequest,
): Promise<GraphResponse> {
  const res = await graphFetch(cred, req);
  const text = await res.text();
  let parsed: GraphResponse = {};
  try {
    parsed = text ? (JSON.parse(text) as GraphResponse) : {};
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) throw new Error(explainGraphError(res.status, parsed, req.permission));
  return parsed;
}

// Reads a file's bytes as text, cut to `maxChars`. Binary files come back as a note
// instead of mojibake.
export async function graphText(
  cred: Microsoft365Credential,
  req: GraphRequest,
  maxChars: number,
): Promise<{ text: string; truncated: boolean; contentType: string }> {
  const res = await graphFetch(cred, req);
  if (!res.ok) {
    const parsed = (await res.json().catch(() => ({}))) as GraphResponse;
    throw new Error(explainGraphError(res.status, parsed, req.permission));
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (!isTextual(contentType)) {
    return { text: '', truncated: false, contentType };
  }
  const text = await res.text();
  return { text: text.slice(0, maxChars), truncated: text.length > maxChars, contentType };
}

export function isTextual(contentType: string): boolean {
  return /^text\/|json|xml|csv|markdown|javascript|yaml/i.test(contentType);
}

// A drive item path segment for /root:/<path>: each part URL-encoded, slashes kept.
export function drivePath(raw: unknown): string {
  const parts = String(raw ?? '')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..');
  if (parts.length === 0) throw new Error('A file path is required, e.g. "Reports/summary.md".');
  return parts.map(encodeURIComponent).join('/');
}

// Where a file tool works: a SharePoint site's document library when a site id is
// given, otherwise the user's OneDrive.
export function driveRoot(cred: Microsoft365Credential, input: Record<string, unknown>): string {
  const site = String(input.siteId ?? '').trim();
  if (site) return `sites/${encodeURIComponent(site)}/drive`;
  return `users/${msUser(cred, input.user)}/drive`;
}

// Strips tags from an HTML mail body so the model reads text, not markup.
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function recipients(raw: unknown): { emailAddress: { address: string } }[] {
  const list = Array.isArray(raw) ? raw : String(raw ?? '').split(/[,;]/);
  return list
    .map((one) => String(one).trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));
}
