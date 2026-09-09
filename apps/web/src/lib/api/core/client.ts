// The transport every endpoint module goes through: the API origin, the request
// helper, and the failure path. The API is a separate service, so every request
// sends credentials (the better-auth session cookie).

import { runtimeEnv } from '@/utils/runtimeEnv';

// The API origin, read from the running server rather than from the build (see
// utils/runtimeEnv). A deployment without it ships a client that cannot reach the
// API. Fail at import instead of pointing at a wrong origin.
export const API_URL = runtimeEnv().apiUrl;
if (!API_URL) throw new Error('API_URL is not set on the web service');

// An error carrying the HTTP status so callers can tell apart 401 (no session),
// 403 (no access to the project / not owner), 404 (not found) and 400 (a
// validation or business-rule failure). `message` is the API's `{ error }` text
// when present, so existing consumers that read `error.message` keep working.
// `code` names the failure where the API sends one, for a caller that has to
// branch on it rather than show the message.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Set while the session is being dropped, by the sign-out below or by the app's own
// `signOut`. Concurrent requests that all fail with 401 then trigger a single
// sign-out and a single navigation, and a sign-out the person asked for does not
// end on the expired screen. One flag for the whole app: it is read and written from
// this module only, so it must not be split across modules.
let signingOut = false;

// Called by `signOut` in @/lib/auth-client before it drops the session: the requests
// that fail right after are the expected fallout, not a session the API refused.
export function markSigningOut(): void {
  signingOut = true;
}

// Called by SessionScope once a session appears without a page load, so a later 401
// is reacted to again. An accepted request does not prove one: /auth-config and the
// invite and share reads answer without a session.
export function markSignedIn(): void {
  signingOut = false;
}

// A 401 means the session behind the cookie is gone. The proxy only checks that a
// session cookie exists, so a stale one keeps the app open on a page where every
// request fails. Sign out to drop the cookie, then leave for the expired screen
// whatever the sign-out answered — a cookie the server declines to clear must not
// hold the browser in the app.
// The request is written out rather than calling `signOut()` from @/lib/auth-client:
// that module reads API_URL from this one, so importing it back here would make a
// cycle that evaluates auth-client before API_URL is assigned.
function endSession(): void {
  if (typeof window === 'undefined' || signingOut) return;
  signingOut = true;
  void fetch(`${API_URL}/api/auth/sign-out`, { method: 'POST', credentials: 'include' })
    .catch(() => {})
    .then(() => window.location.replace('/login?expired=1'));
}

// Every request reports its failure through here, which is where an ended session is
// caught.
export async function apiFailure(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  if (res.status === 401) endSession();
  return new ApiError(res.status, body?.error ?? `${res.status} ${res.statusText}`, body?.code);
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    // Never serve API reads from the HTTP cache — React Query owns caching, and a
    // browser-cached GET can return stale data after a mutation refetch.
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) throw await apiFailure(res);
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Multipart upload. Cannot go through request(), which forces a JSON Content-Type:
// the browser must set the multipart boundary itself, so no headers are set here.
export async function uploadFile<T>(path: string, method: 'POST' | 'PUT', file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}${path}`, { method, credentials: 'include', body: form });
  if (!res.ok) throw await apiFailure(res);
  return res.json();
}
