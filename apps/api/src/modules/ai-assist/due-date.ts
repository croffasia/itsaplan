// Reads a due date out of an issue title: "by Friday", "tomorrow", "next week",
// "on 3 March", an ISO date. Answers 'YYYY-MM-DD' or null. Dates are calendar days in
// UTC, counted from `now`.

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const WEEKDAY = `(${WEEKDAYS.join('|')}|${WEEKDAYS.map((d) => d.slice(0, 3)).join('|')})`;
const MONTH = `(${MONTHS.join('|')}|${MONTHS.map((m) => m.slice(0, 3)).join('|')})`;
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?';
const PREP = '(?:by|on|due|before|until)';

function day(year: number, month: number, date: number): Date | null {
  const d = new Date(Date.UTC(year, month, date));
  return d.getUTCMonth() === month && d.getUTCDate() === date ? d : null;
}

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

function monthIndex(name: string): number {
  return MONTHS.findIndex((m) => m.startsWith(name.slice(0, 3)));
}

// A day and month with no year: this year's, or next year's once this year's has passed.
function nextDayMonth(today: Date, month: number, date: number, year?: string): Date | null {
  if (year) return day(Number(year), month, date);
  const thisYear = day(today.getUTCFullYear(), month, date);
  if (thisYear && thisYear >= today) return thisYear;
  return day(today.getUTCFullYear() + 1, month, date);
}

export function parseDueDate(title: string, now: Date = new Date()): string | null {
  const text = title.toLowerCase();
  const today = day(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())!;
  let m: RegExpMatchArray | null;

  let found: Date | null = null;
  if ((m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) {
    found = day(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  } else if (/\btoday\b/.test(text)) {
    found = today;
  } else if (/\btomorrow\b/.test(text)) {
    found = addDays(today, 1);
  } else if (/\bnext week\b/.test(text)) {
    // The Monday of the following week.
    found = addDays(today, (8 - today.getUTCDay()) % 7 || 7);
  } else if ((m = text.match(new RegExp(`\\b${PREP}\\s+(?:this\\s+)?${WEEKDAY}\\b`)))) {
    const target = WEEKDAYS.findIndex((d) => d.startsWith(m![1].slice(0, 3)));
    found = addDays(today, (target - today.getUTCDay() + 7) % 7 || 7);
  } else if (
    (m = text.match(new RegExp(`\\b${PREP}\\s+${DAY}\\s+${MONTH}\\b(?:,?\\s+(\\d{4}))?`)))
  ) {
    found = nextDayMonth(today, monthIndex(m[2]), Number(m[1]), m[3]);
  } else if (
    (m = text.match(new RegExp(`\\b${PREP}\\s+${MONTH}\\s+${DAY}\\b(?:,?\\s+(\\d{4}))?`)))
  ) {
    found = nextDayMonth(today, monthIndex(m[1]), Number(m[2]), m[3]);
  }
  return found ? found.toISOString().slice(0, 10) : null;
}

// An issue to create with the due date its title names, when it sets none of its own
// and the date does not fall before its start date.
export function withTitleDueDate<
  T extends { title: string; dueDate?: string | null; startDate?: string | null },
>(input: T, now?: Date): T {
  if (input.dueDate !== undefined) return input;
  const dueDate = parseDueDate(input.title, now);
  if (!dueDate || (input.startDate && dueDate < input.startDate)) return input;
  return { ...input, dueDate };
}
