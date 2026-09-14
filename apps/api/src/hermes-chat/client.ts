import { HttpError } from '../shared/lib';
import type { HermesAgentRoute } from './registry';

const CONNECT_TIMEOUT_MS = 5_000;

function configuration(route: HermesAgentRoute): { baseUrl: string; apiKey: string } {
  const rawBaseUrl = process.env.HERMES_API_BASE_URL;
  const apiKey = process.env[route.apiKeyEnv];
  if (!rawBaseUrl || !apiKey) throw new HttpError(503, 'Bob is not configured');

  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new HttpError(503, 'Bob is not configured');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new HttpError(503, 'Bob is not configured');
  }
  return { baseUrl: url.toString().replace(/\/$/, ''), apiKey };
}

function endpoint(route: HermesAgentRoute, path: string): { url: string; apiKey: string } {
  const config = configuration(route);
  return { url: `${config.baseUrl}${route.pathPrefix}${path}`, apiKey: config.apiKey };
}

async function upstreamFetch(
  route: HermesAgentRoute,
  path: string,
  init: RequestInit,
  timeout = CONNECT_TIMEOUT_MS,
): Promise<Response> {
  const target = endpoint(route, path);
  try {
    return await fetch(target.url, {
      ...init,
      headers: {
        Authorization: `Bearer ${target.apiKey}`,
        Accept: 'application/json',
        ...init.headers,
      },
      signal: init.signal ?? AbortSignal.timeout(timeout),
    });
  } catch {
    throw new HttpError(502, 'Bob is unavailable');
  }
}

export async function createHermesSession(
  route: HermesAgentRoute,
  title: string | null,
  requestId: string,
): Promise<string> {
  const response = await upstreamFetch(route, '/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
    body: JSON.stringify({ source: 'vexol_dashboard', ...(title ? { title } : {}) }),
  });
  if (!response.ok) throw new HttpError(502, 'Bob could not create a conversation');

  const body = (await response.json().catch(() => null)) as {
    session?: { id?: unknown };
    session_id?: unknown;
  } | null;
  const sessionId = body?.session?.id ?? body?.session_id;
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 512) {
    throw new HttpError(502, 'Bob returned an invalid conversation');
  }
  return sessionId;
}

export async function openHermesChatStream(
  route: HermesAgentRoute,
  sessionId: string,
  message: string,
  requestId: string,
  signal: AbortSignal,
): Promise<Response> {
  const response = await upstreamFetch(
    route,
    `/api/sessions/${encodeURIComponent(sessionId)}/chat/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({ input: message }),
      signal,
    },
    10 * 60_000,
  );
  if (!response.ok || !response.body) {
    throw new HttpError(502, 'Bob could not start the response');
  }
  return response;
}

export async function checkHermesReadiness(route: HermesAgentRoute): Promise<'ready' | 'offline'> {
  try {
    const response = await upstreamFetch(route, '/v1/capabilities', { method: 'GET' }, 3_000);
    if (!response.ok) return 'offline';
    const body = (await response.json().catch(() => null)) as {
      features?: Record<string, unknown>;
      endpoints?: Record<string, unknown>;
    } | null;
    const features = body?.features;
    const endpoints = body?.endpoints;
    return features?.session_resources === true &&
      features?.session_chat_streaming === true &&
      endpoints?.session_create != null &&
      endpoints?.session_chat_stream != null
      ? 'ready'
      : 'offline';
  } catch {
    return 'offline';
  }
}
