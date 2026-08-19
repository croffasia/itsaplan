import type { StateType } from '@/lib/api';
import { DEFAULT_LOCALE } from '@/i18n/locales';

// Date helpers shared by the project views. Kept separate from project grouping so
// components that only need date math (Calendar, Timeline, cards) do not pull in
// the sorting/grouping code.

// The language dates are rendered in. A module variable for the same reason as the
// timezone below; PreferencesSync sets it in the browser while rendering, before the
// tree that formats dates. A server render keeps the default, so the value never
// crosses between requests.
let displayLocale: string = DEFAULT_LOCALE;

export function setDisplayLocale(locale: string): void {
  displayLocale = locale;
}

export function getDisplayLocale(): string {
  return displayLocale;
}

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
  return date.toLocaleDateString(displayLocale, {
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
  return date.toLocaleDateString(displayLocale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(dateOnly ? {} : zoneOption()),
  });
}

// The year a moment falls in, in the display zone. A fixed locale: the value is
// compared, never shown.
function zonedYear(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', ...zoneOption() });
}

// "Jul 2, 14:05" for a moment in time, rendered in the user's zone. A moment from
// another year carries it — "Jul 2, 2025, 14:05" — so an old row is not read as a
// recent one.
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const thisYear = zonedYear(date) === zonedYear(new Date());
  return date.toLocaleString(displayLocale, {
    month: 'short',
    day: 'numeric',
    ...(thisYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...zoneOption(),
  });
}

// The display zone's offset at a given moment, in ms (zone time minus UTC).
function zoneOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...zoneOption(),
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return asUtc - date.getTime();
}

// The "YYYY-MM-DD" day and "HH:mm" time a moment falls on in the user's zone —
// the parts a date-time picker edits. Null for an unparseable value.
export function toZonedParts(value: string): { day: string; time: string } | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + zoneOffsetMs(date)).toISOString();
  return { day: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

// The moment a day + time in the user's zone stands for, as an ISO string. The
// offset is resolved against the result as well, so a time on a DST switch lands
// on the offset in force at the moment itself.
export function fromZonedParts(day: string, time: string): string {
  const asUtc = new Date(`${day}T${time}:00Z`);
  const first = new Date(asUtc.getTime() - zoneOffsetMs(asUtc));
  return new Date(asUtc.getTime() - zoneOffsetMs(first)).toISOString();
}

// "Jul 2, 14:05 – 16:30" for a range, rendered in the user's zone; the day is
// repeated on the end when it falls on another one. Without an end it is a
// single moment.
export function formatDateTimeRange(start: string, end: string | null): string {
  if (!end) return formatDateTime(start);
  if (dayKey(start) !== dayKey(end)) return `${formatDateTime(start)} – ${formatDateTime(end)}`;
  return `${formatDateTime(start)} – ${toZonedParts(end)?.time ?? end}`;
}

// "July 2, 2026" for a moment in time, rendered in the user's zone.
export function formatLongDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(displayLocale, {
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
  return date.toLocaleTimeString(displayLocale, {
    hour: 'numeric',
    minute: '2-digit',
    ...zoneOption(),
  });
}

// "July 2026" for a calendar date the caller already built in local time (the
// timeline's month band), so no zone is applied.
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(displayLocale, { month: 'long', year: 'numeric' });
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

// A compact duration, e.g. "5m", "3h", "11d". Largest whole unit among
// minutes/hours/days; under a minute reads as "0m".
export function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// The same compact duration, counted from an ISO datetime to now. Empty string for an
// unparseable value.
export function formatDurationShort(fromIso: string): string {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return '';
  return formatDuration(Date.now() - from);
}

// A new local date `n` days after `date` (n may be negative).
export function addDays(date: Date, n: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return next;
}
