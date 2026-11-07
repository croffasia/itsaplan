import { getSharedView, type SharedViewBundle } from './service';

// A calendar feed for a shared view. Calendar clients poll the link; it carries one
// all-day event per issue that has the date the view places it by. The share token
// is the only credential, so revoking the share stops the feed too.

const CUSTOM_DATE_FIELD = /^cf:(\d+)$/;

type SharedIssue = SharedViewBundle['issues'][number];

interface DatedIssue {
  issue: SharedIssue;
  day: string;
}

export async function getSharedViewCalendar(token: string): Promise<string | null> {
  const bundle = await getSharedView(token);
  return bundle ? buildCalendar(bundle) : null;
}

function buildCalendar(bundle: SharedViewBundle): string {
  const dateField = calendarDateField(bundle.view.display);
  const events = bundle.issues
    .map((issue) => ({ issue, day: issueDay(issue, dateField, bundle) }))
    .filter((event): event is DatedIssue => event.day !== null)
    .sort((a, b) => a.day.localeCompare(b.day) || a.issue.id - b.issue.id);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ItsaPlan//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(bundle.view.name)}`,
    ...events.flatMap((event) => eventLines(event.issue, event.day)),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

function calendarDateField(display: unknown): string {
  const value =
    display && typeof display === 'object'
      ? (display as { calendarDateField?: unknown }).calendarDateField
      : null;
  if (value === 'startDate' || value === 'dueDate') return value;
  if (typeof value === 'string' && CUSTOM_DATE_FIELD.test(value)) return value;
  return 'dueDate';
}

// A custom date field is only known when the link exposes full issue details, and
// only placed when its value is exposed too. Otherwise the feed uses the due date,
// the same fallback the calendar layout takes for a deleted field, so the feed
// never reveals a value the public page hides.
function issueDay(issue: SharedIssue, dateField: string, bundle: SharedViewBundle): string | null {
  if (dateField === 'startDate') return calendarDay(issue.startDate);
  if (dateField === 'dueDate') return calendarDay(issue.dueDate);

  const match = CUSTOM_DATE_FIELD.exec(dateField);
  if (!match) return calendarDay(issue.dueDate);
  const fieldId = Number(match[1]);
  const field = bundle.project.customFields.find((f) => f.id === fieldId && isCalendarField(f));
  if (!field) return calendarDay(issue.dueDate);

  const entry = issue.fieldValues.find((value) => value.fieldId === fieldId);
  const raw = typeof entry?.value === 'string' ? entry.value : null;
  if (!raw) return null;
  return calendarDay(field.fieldType === 'date' ? raw : raw.slice(0, 10));
}

function isCalendarField(field: { fieldType: string }): boolean {
  return (
    field.fieldType === 'date' ||
    field.fieldType === 'datetime' ||
    field.fieldType === 'datetime_range'
  );
}

function calendarDay(value: string | null): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function eventLines(issue: SharedIssue, day: string): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:issue-${issue.id}@itsaplan`,
    `DTSTAMP:${icsStamp(issue.updatedAt)}`,
    `DTSTART;VALUE=DATE:${day.replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${addDay(day).replace(/-/g, '')}`,
    `SUMMARY:${escapeText(`${issue.identifier} ${issue.title}`)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
}

function addDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function icsStamp(value: string): string {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

// RFC 5545 folds a content line longer than 75 octets. Continuation lines start
// with one space, which is part of their 75 octets.
const UTF8 = new TextEncoder();

function foldLine(line: string): string {
  if (UTF8.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let part = '';
  let bytes = 0;
  for (const char of line) {
    const size = UTF8.encode(char).length;
    if (bytes + size > 75) {
      parts.push(part);
      part = ` ${char}`;
      bytes = 1 + size;
    } else {
      part += char;
      bytes += size;
    }
  }
  parts.push(part);
  return parts.join('\r\n');
}
