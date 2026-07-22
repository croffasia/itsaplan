import { z } from 'zod';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A since/until time-range filter value. Accepts either a unix timestamp in seconds
// or a date string, because a model often cannot compute a unix timestamp and passes
// a plain date (e.g. "2026-06-14"). The value is normalized to unix seconds with
// toUnixSeconds() before it reaches the API, so this works even on endpoints whose
// docs only accept a unix timestamp (Instagram insights) rather than a parseable
// date string (Threads).
export const timeFilter = z.union([z.number().int(), z.string()]);

// Coerce a time-filter value to unix seconds. A number is taken as seconds already; a
// numeric string is parsed as seconds; any other string is parsed as a date
// (Date.parse handles "2026-06-14" and ISO datetimes, in UTC). Unix milliseconds are
// not supported (the API reads them as a far-future seconds value), so a 13-digit
// numeric string stays as-is and the caller/API rejects it. Returns undefined for a
// missing value; throws on an unparseable string.
export function toUnixSeconds(v: number | string | undefined | null): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Math.floor(v);
  const s = v.trim();
  if (/^\d+$/.test(s)) return Number(s);
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid date: "${v}". Use a unix timestamp in seconds or a date like "2026-06-14".`,
    );
  }
  return Math.floor(ms / 1000);
}
