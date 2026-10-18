import type { StorageDriver } from './driver';
import { contentTypeFromKey, DEFAULT_CONTENT_TYPE, sniffContentType } from './content-type';

// SharePoint document library / OneDrive through Microsoft Graph, app-only (client
// credentials). Every object key becomes a file under SHAREPOINT_ROOT_FOLDER in one
// drive; folders are created implicitly by the upload.

const GRAPH = 'https://graph.microsoft.com/v1.0';
const LOGIN = 'https://login.microsoftonline.com';

// A simple PUT takes at most 4 MB; anything larger needs an upload session.
export const SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024;
// Upload session chunks must be a multiple of 320 KiB. 32 x 320 KiB = 10 MiB.
export const UPLOAD_CHUNK_SIZE = 32 * 320 * 1024;

const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 30_000;
const RETRY_STATUSES = new Set([429, 503, 504]);
// Refresh the token this long before it expires.
const TOKEN_SKEW_MS = 60_000;

export interface SharePointConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId?: string;
  driveId?: string;
  rootFolder?: string;
}

export interface SharePointDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GraphError';
  }
}

export function sharePointConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SharePointConfig {
  const tenantId = env.SHAREPOINT_TENANT_ID;
  const clientId = env.SHAREPOINT_CLIENT_ID;
  const clientSecret = env.SHAREPOINT_CLIENT_SECRET;
  const siteId = env.SHAREPOINT_SITE_ID || undefined;
  const driveId = env.SHAREPOINT_DRIVE_ID || undefined;
  if (!tenantId || !clientId || !clientSecret || (!siteId && !driveId)) {
    throw new Error(
      'SharePoint storage is not configured: set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET and SHAREPOINT_SITE_ID (or SHAREPOINT_DRIVE_ID).',
    );
  }
  return {
    tenantId,
    clientId,
    clientSecret,
    siteId,
    driveId,
    rootFolder: env.SHAREPOINT_ROOT_FOLDER || undefined,
  };
}

// Splits a path into segments, rejecting empty, "." and ".." ones, and URL-encodes
// each so it can sit in a Graph path-addressed URL.
function encodePath(path: string, what: string): string {
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..' || segment.includes('\\')) {
      throw new Error(`Invalid ${what} '${path}'`);
    }
  }
  return segments.map(encodeURIComponent).join('/');
}

function parseRetryAfter(value: string | null, now: number): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

export function createSharePointDriver(
  config: SharePointConfig,
  deps: SharePointDeps = {},
): StorageDriver {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const root = encodePath(
    (config.rootFolder ?? 'itsaplan').replace(/^\/+|\/+$/g, ''),
    'root folder',
  );

  let token: { value: string; expiresAt: number } | null = null;
  let tokenRequest: Promise<string> | null = null;
  let drive: string | undefined = config.driveId;

  async function fetchToken(): Promise<string> {
    const res = await doFetch(`${LOGIN}/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
    });
    if (!res.ok) {
      throw new GraphError(
        `Microsoft Graph token request failed (${res.status}): ${await errorText(res)}`,
        res.status,
      );
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error('Microsoft Graph token response has no access_token');
    token = { value: json.access_token, expiresAt: now() + (json.expires_in ?? 3600) * 1000 };
    return token.value;
  }

  function getToken(): Promise<string> {
    if (token && now() < token.expiresAt - TOKEN_SKEW_MS) return Promise.resolve(token.value);
    tokenRequest ??= fetchToken().finally(() => {
      tokenRequest = null;
    });
    return tokenRequest;
  }

  async function errorText(res: Response): Promise<string> {
    return (await res.text().catch(() => '')).slice(0, 500);
  }

  // One request with bounded retries on 429/503/504 (honouring Retry-After) and a
  // single token refresh on 401. `auth: false` is for pre-authenticated URLs (an
  // upload session URL or a download redirect), which must never see the bearer.
  async function request(url: string, init: RequestInit = {}, auth = true): Promise<Response> {
    let refreshed = false;
    for (let attempt = 1; ; attempt++) {
      const headers = new Headers(init.headers);
      if (auth) headers.set('Authorization', `Bearer ${await getToken()}`);
      const res = await doFetch(url, { ...init, headers });
      if (res.status === 401 && auth && !refreshed) {
        refreshed = true;
        token = null;
        await res.body?.cancel();
        continue;
      }
      if (!RETRY_STATUSES.has(res.status) || attempt >= MAX_ATTEMPTS) return res;
      const wait = parseRetryAfter(res.headers.get('Retry-After'), now());
      await res.body?.cancel();
      await sleep(Math.min(wait ?? 500 * 2 ** (attempt - 1), MAX_BACKOFF_MS));
    }
  }

  async function driveId(): Promise<string> {
    if (drive) return drive;
    const res = await request(
      `${GRAPH}/sites/${encodeURIComponent(config.siteId!)}/drive?$select=id`,
    );
    if (!res.ok) {
      throw new GraphError(
        `Could not resolve the SharePoint site's default drive (${res.status}): ${await errorText(res)}`,
        res.status,
      );
    }
    drive = ((await res.json()) as { id: string }).id;
    return drive;
  }

  async function itemUrl(key: string, suffix = ''): Promise<string> {
    const path = `${root}/${encodePath(key, 'object key')}`;
    return `${GRAPH}/drives/${encodeURIComponent(await driveId())}/root:/${path}${suffix}`;
  }

  async function fail(action: string, key: string, res: Response): Promise<never> {
    throw new GraphError(
      `SharePoint ${action} of '${key}' failed (${res.status}): ${await errorText(res)}`,
      res.status,
    );
  }

  async function putSession(key: string, body: Buffer): Promise<void> {
    const create = await request(await itemUrl(key, ':/createUploadSession'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    });
    if (!create.ok) return fail('upload session', key, create);
    const { uploadUrl } = (await create.json()) as { uploadUrl: string };
    try {
      for (let start = 0; start < body.length; start += UPLOAD_CHUNK_SIZE) {
        const end = Math.min(start + UPLOAD_CHUNK_SIZE, body.length);
        const res = await request(
          uploadUrl,
          {
            method: 'PUT',
            headers: {
              'Content-Length': String(end - start),
              'Content-Range': `bytes ${start}-${end - 1}/${body.length}`,
            },
            body: body.subarray(start, end),
          },
          false,
        );
        if (res.status !== 200 && res.status !== 201 && res.status !== 202) {
          return await fail('chunk upload', key, res);
        }
        await res.body?.cancel();
      }
    } catch (error) {
      await doFetch(uploadUrl, { method: 'DELETE' }).catch(() => {});
      throw error;
    }
  }

  return {
    async put(key, body, contentType) {
      // The content type is not stored (see content-type.ts); Graph derives its own
      // from the file name, so it is sent only as a hint.
      if (body.length > SIMPLE_UPLOAD_MAX) {
        await putSession(key, body);
        return;
      }
      const res = await request(
        await itemUrl(key, ':/content?@microsoft.graph.conflictBehavior=replace'),
        { method: 'PUT', headers: { 'Content-Type': contentType }, body },
      );
      if (!res.ok) return fail('upload', key, res);
      await res.body?.cancel();
    },

    async get(key) {
      const first = await request(await itemUrl(key, ':/content'), { redirect: 'manual' });
      let res = first;
      if (first.status >= 300 && first.status < 400) {
        const location = first.headers.get('Location');
        if (!location)
          throw new Error(`SharePoint download of '${key}' redirected without Location`);
        // Pre-authenticated download URL on another host: no bearer token.
        res = await request(location, {}, false);
      }
      if (res.status === 404) {
        await res.body?.cancel();
        throw new GraphError(`Object '${key}' not found`, 404);
      }
      if (!res.ok || !res.body) return fail('download', key, res);
      const length = Number(res.headers.get('Content-Length'));
      const contentLength =
        Number.isFinite(length) && res.headers.has('Content-Length') ? length : undefined;
      let contentType = contentTypeFromKey(key);
      let body: ReadableStream = res.body;
      if (!contentType) {
        const peeked = await peek(res.body);
        body = peeked.body;
        contentType = (peeked.head && sniffContentType(peeked.head)) || DEFAULT_CONTENT_TYPE;
      }
      return { body, contentType, contentLength };
    },

    async delete(key) {
      const res = await request(await itemUrl(key), { method: 'DELETE' });
      if (res.status === 404) {
        await res.body?.cancel();
        return;
      }
      if (!res.ok) return fail('delete', key, res);
      await res.body?.cancel();
    },
  };
}

// Reads the first chunk of a stream and hands back an equivalent stream.
async function peek(source: ReadableStream<Uint8Array>) {
  const reader = source.getReader();
  const first = await reader.read();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (first.done) controller.close();
      else controller.enqueue(first.value);
    },
    async pull(controller) {
      if (first.done) return;
      const next = await reader.read();
      if (next.done) controller.close();
      else controller.enqueue(next.value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return { body, head: first.done ? undefined : first.value };
}
