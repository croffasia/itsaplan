export interface CronFields {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WEEKDAY_ALIASES: Record<string, string> = {
  sun: '0',
  sunday: '0',
  mon: '1',
  monday: '1',
  tue: '2',
  tues: '2',
  tuesday: '2',
  wed: '3',
  wednesday: '3',
  thu: '4',
  thur: '4',
  thurs: '4',
  thursday: '4',
  fri: '5',
  friday: '5',
  sat: '6',
  saturday: '6',
};

const MONTH_ALIASES = Object.fromEntries(
  MONTH_NAMES.flatMap((name, index) => [
    [name.toLowerCase(), String(index + 1)],
    [name.slice(0, 3).toLowerCase(), String(index + 1)],
  ]),
);

const FIELD_RULES = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, aliases: MONTH_ALIASES },
  { name: 'day of week', min: 0, max: 7, aliases: WEEKDAY_ALIASES },
] as const;

export function parseCron(expression: string): ParseResult<CronFields> {
  const parts = expression.trim().toLowerCase().split(/\s+/);
  if (parts.length !== 5) return failure('Use a standard five-field cron expression.');

  const normalized: string[] = [];
  for (let index = 0; index < FIELD_RULES.length; index += 1) {
    const result = normalizeField(parts[index], FIELD_RULES[index]);
    if (!result.ok) return result;
    normalized.push(result.value);
  }

  return {
    ok: true,
    value: {
      minute: normalized[0],
      hour: normalized[1],
      dayOfMonth: normalized[2],
      month: normalized[3],
      dayOfWeek: normalized[4],
    },
  };
}

export function formatCron(fields: CronFields): string {
  return `${fields.minute} ${fields.hour} ${fields.dayOfMonth} ${fields.month} ${fields.dayOfWeek}`;
}

function normalizeField(
  field: string,
  rule: { name: string; min: number; max: number; aliases?: Record<string, string> },
): ParseResult<string> {
  const segments = field.split(',');
  if (segments.some((segment) => segment.length === 0))
    return failure(`Check the ${rule.name} field.`);

  const normalized: string[] = [];
  for (const segment of segments) {
    const result = normalizeSegment(segment, rule);
    if (!result.ok) return result;
    normalized.push(result.value);
  }
  return { ok: true, value: normalized.join(',') };
}

function normalizeSegment(
  segment: string,
  rule: { name: string; min: number; max: number; aliases?: Record<string, string> },
): ParseResult<string> {
  const [base, step, extra] = segment.split('/');
  if (extra !== undefined || base.length === 0) return failure(`Check the ${rule.name} field.`);
  if (step !== undefined && !isNumberInRange(step, 1, rule.max - rule.min + 1)) {
    return failure(`The ${rule.name} step is out of range.`);
  }

  if (base === '*') return { ok: true, value: step ? `*/${Number(step)}` : '*' };

  const bounds = base.split('-');
  if (bounds.length > 2) return failure(`Check the ${rule.name} range.`);
  const normalizedBounds = bounds.map((value) => rule.aliases?.[value] ?? value);
  if (normalizedBounds.some((value) => !isNumberInRange(value, rule.min, rule.max))) {
    return failure(`The ${rule.name} value is out of range.`);
  }
  if (normalizedBounds.length === 2 && Number(normalizedBounds[0]) > Number(normalizedBounds[1])) {
    return failure(`The ${rule.name} range must go from low to high.`);
  }

  const normalizedBase = normalizedBounds.map(Number).join('-');
  return { ok: true, value: step ? `${normalizedBase}/${Number(step)}` : normalizedBase };
}

function isNumberInRange(value: string, min: number, max: number): boolean {
  if (!/^\d+$/.test(value)) return false;
  const number = Number(value);
  return number >= min && number <= max;
}

function failure<T>(error: string): ParseResult<T> {
  return { ok: false, error };
}
