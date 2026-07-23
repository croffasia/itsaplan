import type { StateType } from '@/lib/api';

// Date helpers shared by the project views. Kept separate from project grouping so
// components that only need date math (Calendar, Timeline, cards) do not pull in
// the sorting/grouping code.

// The zone timestamps are rendered in, from the user's account preferences. The API
// stores and returns UTC; only the display side applies a zone. Held in a module
// variable so the formatters stay plain functions callable outside React, and set
// once by PreferencesSync when the preferences load. Empty means "use the browser
// zone", which is what an unauthenticated or not-yet-loaded screen falls back to.
let displayTimezone = '';

export function setDisplayTimezone(timezone: string): void {
  displayTimezone = timezone;
}

// Zones IANA renamed but whose old name most runtimes still report. Both names
// resolve to the same zone, so the app offers, detects and stores the current one.
const RENAMED_ZONES: Record<string, string> = {
  'Africa/Asmera': 'Africa/Asmara',
  'America/Godthab': 'America/Nuuk',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Ulan_Bator': 'Asia/Ulaanbaatar',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Europe/Kiev': 'Europe/Kyiv',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
};

// The current IANA name for a zone, given a possibly outdated one.
export function canonicalTimezone(zone: string): string {
  return RENAMED_ZONES[zone] ?? zone;
}

// The timezone option for Intl. Omitted while no preference is known, so Intl uses
// the browser zone.
function zoneOption(): { timeZone?: string } {
  return displayTimezone ? { timeZone: displayTimezone } : {};
}

// "Jul 2" from an ISO datetime or a "YYYY-MM-DD" date; the raw string if it
// does not parse (kept so a card never renders "Invalid Date"). A date-only value
// is a calendar date, not a moment, so it is never shifted into another zone.
export function formatShortDate(value: string): string {
  const dateOnly = value.length <= 10;
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(dateOnly ? {} : zoneOption()),
  });
}

// "Jul 2, 2026" for a moment in time (an ISO datetime from the API), rendered in
// the user's zone. Date-only values ("YYYY-MM-DD") pass through unshifted.
export function formatDate(value: string): string {
  const dateOnly = value.length <= 10;
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(dateOnly ? {} : zoneOption()),
  });
}

// "Jul 2, 14:05" for a moment in time, rendered in the user's zone.
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...zoneOption(),
  });
}

// "July 2, 2026" for a moment in time, rendered in the user's zone.
export function formatLongDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    ...zoneOption(),
  });
}

// "2:05 PM" for a moment in time, rendered in the user's zone.
export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...zoneOption() });
}

// The calendar day a moment falls on in the user's zone, as "YYYY-MM-DD". Used to
// group a list by day, so the grouping matches the dates rendered next to it.
export function dayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-CA', zoneOption());
}

// Parses a "YYYY-MM-DD" date string at local midnight, so day math in the
// calendar and timeline never shifts across a timezone boundary. Returns null
// for a null/empty/unparseable value.
export function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

// True when a due date ("YYYY-MM-DD") is before today (local) — i.e. overdue. A
// date of today is not overdue; a null/unparseable value is never overdue.
export function isOverdue(value: string | null): boolean {
  const date = parseDate(value);
  if (!date) return false;
  const now = new Date();
  return date.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

// Like isOverdue, but a closed issue (completed or canceled state) is never
// overdue: its due date passing no longer matters.
export function isDueOverdue(value: string | null, stateType?: StateType): boolean {
  if (stateType === 'completed' || stateType === 'canceled') return false;
  return isOverdue(value);
}

// A local Date back to "YYYY-MM-DD" (the wire format the API stores dates in).
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Whole days between two local dates (b - a), ignoring the time of day.
export function daysBetween(a: Date, b: Date): number {
  const day = 24 * 60 * 60 * 1000;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / day);
}

// Compact elapsed time since an ISO datetime, e.g. "5m", "3h", "11d". Largest
// whole unit among minutes/hours/days; sub-minute reads as "0m". Used by the
// time-in-current-status badge. Empty string for an unparseable value.
export function formatDurationShort(fromIso: string): string {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - from) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// A new local date `n` days after `date` (n may be negative).
export function addDays(date: Date, n: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return next;
}
