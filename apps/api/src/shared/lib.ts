// Shared helpers for the planner API (projects, issues, and their dependent
// entities). Each feature folder holds a store.ts (Drizzle data access) and a
// routes.ts (Elysia routes) that exposes it over HTTP.

// An error carrying an HTTP status. Thrown from stores and routes; the planner
// plugin's onError maps it to a { error } JSON response with that status.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// A timestamptz column comes back from Drizzle as a JS Date; callers return it
// as an ISO string. `date` columns come back as raw 'YYYY-MM-DD' strings
// (Drizzle's default mode for date), so no timezone is ever applied to them.
export const iso = (value: Date): string => value.toISOString();

// numeric columns come back as strings; coerce to a JS number.
export const num = (value: unknown): number => (value == null ? 0 : Number(value));

// Escapes the five characters that are significant in HTML/XML text, so a value
// (an issue title, a user name) is safe to interpolate into an HTML email body or a
// Telegram HTML message.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The Postgres SQLSTATE of a driver error. Drizzle wraps the driver error in a
// DrizzleQueryError with the original as `.cause`, so the code may be one level
// down; unwrap the cause chain to find it.
export function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; current && typeof current === 'object' && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

// Maps a Postgres unique_violation (a duplicate name on a UNIQUE constraint) to
// a clean 409, so the UI shows "already exists" instead of an opaque 500. Any
// other error is rethrown unchanged.
export function rethrowDuplicate(err: unknown, what: string): never {
  if (pgErrorCode(err) === '23505') {
    throw new HttpError(409, `A ${what} with this name already exists.`);
  }
  throw err;
}
