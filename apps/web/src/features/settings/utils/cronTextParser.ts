import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  formatCron,
  type CronFields,
  type ParseResult,
} from './cronFields';

interface TimeValue {
  hour: number;
  minute: number;
}

interface TimeWindow {
  start: TimeValue;
  end: TimeValue;
}

const WEEKDAY_VALUES = nameValues(WEEKDAY_NAMES, 0);
const MONTH_VALUES = nameValues(MONTH_NAMES, 1);

export function parseCronText(input: string): ParseResult<string> {
  const text = normalizeText(input);
  const unsupported = unsupportedReason(text);
  if (unsupported) return { ok: false, error: unsupported };

  const interval = extractInterval(text);
  if (!interval.ok) return interval;
  const window = extractWindow(text);
  if (!window.ok) return window;
  const times = extractTimes(text, window.value !== null);
  if (!times.ok) return times;
  const hourlyMinute = extractHourlyMinute(text);
  if (!hourlyMinute.ok) return hourlyMinute;
  let intervalValue = interval.value;
  if (hourlyMinute.value !== null && intervalValue === null) {
    if (/\b(daily|weekly|monthly|quarterly|yearly|annually)\b/.test(text)) {
      return { ok: false, error: 'Minute offsets require an hourly schedule.' };
    }
    intervalValue = { unit: 'hour', value: 1 };
  }
  if (hourlyMinute.value !== null && intervalValue?.unit !== 'hour') {
    return { ok: false, error: 'Minute offsets require an hourly schedule.' };
  }
  if (intervalValue?.unit === 'hour' && times.value.length > 0) {
    return {
      ok: false,
      error: 'Starting-hour anchors are not supported. Use a time window instead.',
    };
  }
  if (window.value && !intervalValue) {
    return { ok: false, error: 'Time windows require a minute or hour interval.' };
  }
  if (
    window.value &&
    intervalValue?.unit === 'minute' &&
    (window.value.start.minute !== 0 || window.value.end.minute !== 0)
  ) {
    return { ok: false, error: 'Minute-interval windows must start and end on a whole hour.' };
  }
  if (
    window.value &&
    intervalValue?.unit === 'hour' &&
    window.value.start.minute !== window.value.end.minute
  ) {
    return { ok: false, error: 'Hourly windows must use the same minute at both ends.' };
  }

  const monthDayError = validateMonthDays(text);
  if (monthDayError) return { ok: false, error: monthDayError };
  const namedRangeError = validateNamedRanges(text);
  if (namedRangeError) return { ok: false, error: namedRangeError };

  const weekdays = extractNamedValues(text, WEEKDAY_VALUES, WEEKDAY_NAMES.length);
  const months = extractNamedValues(text, MONTH_VALUES, MONTH_NAMES.length);
  const monthDays = extractMonthDays(text);
  const hasKnownWords =
    /(every|hourly|daily|weekly|monthly|quarterly|yearly|weekday|weekend|midnight|noon|at)\b/.test(
      text,
    );
  if (!hasKnownWords && weekdays.length === 0 && months.length === 0 && monthDays.length === 0) {
    return { ok: false, error: 'Try a schedule such as "Every weekday at 9:00 AM".' };
  }

  const fields = buildFields(
    text,
    intervalValue,
    window.value,
    times.value,
    hourlyMinute.value,
    weekdays,
    months,
    monthDays,
  );
  if (!fields.ok) return fields;
  return { ok: true, value: formatCron(fields.value) };
}

function buildFields(
  text: string,
  interval: { unit: 'minute' | 'hour'; value: number } | null,
  window: TimeWindow | null,
  times: TimeValue[],
  hourlyMinute: number | null,
  namedWeekdays: number[],
  namedMonths: number[],
  monthDays: number[],
): ParseResult<CronFields> {
  let minute = '0';
  let hour = '0';
  let dayOfMonth = numbersToField(monthDays);
  let month = numbersToField(namedMonths);
  let dayOfWeek = numbersToField(namedWeekdays);

  if (/\bweekdays?\b/.test(text)) dayOfWeek = '1-5';
  if (/\bweekends?\b/.test(text)) dayOfWeek = '0,6';

  if (interval?.unit === 'minute') {
    minute = interval.value === 1 ? '*' : `*/${interval.value}`;
    hour = window ? `${window.start.hour}-${window.end.hour}` : '*';
  } else if (interval?.unit === 'hour') {
    minute = String(window?.start.minute ?? hourlyMinute ?? 0);
    if (window) {
      hour =
        interval.value === 1
          ? `${window.start.hour}-${window.end.hour}`
          : `${window.start.hour}-${window.end.hour}/${interval.value}`;
    } else {
      hour = interval.value === 1 ? '*' : `*/${interval.value}`;
    }
  } else if (times.length > 0) {
    const minutes = [...new Set(times.map((time) => time.minute))];
    if (minutes.length > 1) {
      return { ok: false, error: 'Use a separate schedule for times with different minutes.' };
    }
    minute = String(minutes[0]);
    hour = numbersToField(times.map((time) => time.hour));
  }

  if (/\bweekly\b|\bevery week\b/.test(text) && dayOfWeek === '*') dayOfWeek = '0';
  if (/\bmonthly\b|\bevery month\b/.test(text) && dayOfMonth === '*') dayOfMonth = '1';
  if (/\bquarterly\b/.test(text)) {
    month = '1,4,7,10';
    if (dayOfMonth === '*') dayOfMonth = '1';
  }
  if (/\byearly\b|\bannually\b|\bevery year\b/.test(text)) {
    if (month === '*') month = '1';
    if (dayOfMonth === '*') dayOfMonth = '1';
  }
  if (dayOfMonth !== '*' && dayOfWeek !== '*') {
    return { ok: false, error: 'Day-of-month and weekday rules need separate schedules.' };
  }

  return { ok: true, value: { minute, hour, dayOfMonth, month, dayOfWeek } };
}

function extractInterval(
  text: string,
): ParseResult<{ unit: 'minute' | 'hour'; value: number } | null> {
  const numbered = text.match(/\bevery\s+(\d+)\s+(minutes?|mins?|hours?|hrs?)\b/);
  if (numbered) {
    const unit = /^(minute|min)/.test(numbered[2]) ? 'minute' : 'hour';
    const value = Number(numbered[1]);
    const max = unit === 'minute' ? 59 : 23;
    if (value < 1 || value > max)
      return { ok: false, error: `Use a ${unit} interval between 1 and ${max}.` };
    return { ok: true, value: { unit, value } };
  }
  if (/\bevery\s+\d+\s+[a-z]+\b/.test(text)) {
    return { ok: false, error: 'Numeric intervals support minutes and hours only.' };
  }
  if (/\b(minutely|every minute)\b/.test(text))
    return { ok: true, value: { unit: 'minute', value: 1 } };
  if (/\b(hourly|every hour)\b/.test(text)) return { ok: true, value: { unit: 'hour', value: 1 } };
  return { ok: true, value: null };
}

function extractWindow(text: string): ParseResult<TimeWindow | null> {
  const match = text.match(/\bbetween\s+(.+?)\s+and\s+(.+?)(?:\s+(?:on|every|during)\b|$)/);
  if (!match) return { ok: true, value: null };
  const start = parseTime(match[1]);
  const end = parseTime(match[2]);
  if (!start || !end) return { ok: false, error: 'Check the time window.' };
  if (start.hour > end.hour)
    return { ok: false, error: 'The time window must end after it starts.' };
  return { ok: true, value: { start, end } };
}

function extractTimes(text: string, hasWindow: boolean): ParseResult<TimeValue[]> {
  if (hasWindow) return { ok: true, value: [] };
  const textWithoutMinuteOffset = text.replace(/\bat\s+\d+\s+minutes?\s+past\s+the\s+hour\b/g, '');
  const matches = [
    ...textWithoutMinuteOffset.matchAll(
      /\b(?:at|and)\s+(midnight|noon|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/g,
    ),
  ];
  const values: TimeValue[] = [];
  for (const match of matches) {
    const parsed = parseTime(match[1]);
    if (!parsed) return { ok: false, error: `Check the time "${match[1]}".` };
    values.push(parsed);
  }
  return { ok: true, value: uniqueTimes(values) };
}

function extractHourlyMinute(text: string): ParseResult<number | null> {
  const match = text.match(/\bat\s+(\d+)\s+minutes?\s+past\s+the\s+hour\b/);
  if (!match) return { ok: true, value: null };
  const minute = Number(match[1]);
  if (minute > 59) return { ok: false, error: 'Use a minute offset between 0 and 59.' };
  return { ok: true, value: minute };
}

function parseTime(value: string): TimeValue | null {
  if (value === 'midnight') return { hour: 0, minute: 0 };
  if (value === 'noon') return { hour: 12, minute: 0 };
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const period = match[3];
  if (period && (hour < 1 || hour > 12)) return null;
  if (!period && hour > 23) return null;
  if (minute > 59) return null;
  if (period === 'am') hour %= 12;
  if (period === 'pm') hour = (hour % 12) + 12;
  return { hour, minute };
}

function extractNamedValues(text: string, values: Record<string, number>, count: number): number[] {
  const range = text.match(
    new RegExp(
      `\\b(${Object.keys(values).join('|')})\\s+(?:through|to|-)\\s+(${Object.keys(values).join('|')})\\b`,
    ),
  );
  if (range) {
    const start = values[range[1]];
    const end = values[range[2]];
    if (start <= end) return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  const matches = [...text.matchAll(new RegExp(`\\b(${Object.keys(values).join('|')})\\b`, 'g'))];
  const selected = [...new Set(matches.map((match) => values[match[1]]))].sort((a, b) => a - b);
  return selected.length === count ? [] : selected;
}

function extractMonthDays(text: string): number[] {
  const ordinals = [...text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)\b/g)].map((match) =>
    Number(match[1]),
  );
  const range = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)\s+(?:through|to|-)\s+(\d{1,2})(?:st|nd|rd|th)\b/,
  );
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start <= end) return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  const monthDay = text.match(
    new RegExp(`\\b(?:${Object.keys(MONTH_VALUES).join('|')})\\s+(\\d{1,2})\\b`),
  );
  if (monthDay) ordinals.push(Number(monthDay[1]));
  return [...new Set(ordinals.filter((day) => day >= 1 && day <= 31))].sort((a, b) => a - b);
}

function validateMonthDays(text: string): string | null {
  const ordinals = [...text.matchAll(/\b(\d+)(?:st|nd|rd|th)\b/g)].map((match) => Number(match[1]));
  if (ordinals.some((day) => day < 1 || day > 31)) return 'Use a day of month between 1 and 31.';

  const range = text.match(/\b(\d+)(?:st|nd|rd|th)\s+(?:through|to|-)\s+(\d+)(?:st|nd|rd|th)\b/);
  if (range && Number(range[1]) > Number(range[2]))
    return 'The day-of-month range must go from low to high.';

  const namedDay = text.match(
    new RegExp(`\\b(?:${Object.keys(MONTH_VALUES).join('|')})\\s+(\\d+)\\b`),
  );
  if (namedDay && (Number(namedDay[1]) < 1 || Number(namedDay[1]) > 31)) {
    return 'Use a day of month between 1 and 31.';
  }
  return null;
}

function validateNamedRanges(text: string): string | null {
  if (hasReversedNamedRange(text, WEEKDAY_VALUES))
    return 'The weekday range must go from low to high.';
  if (hasReversedNamedRange(text, MONTH_VALUES)) return 'The month range must go from low to high.';
  return null;
}

function hasReversedNamedRange(text: string, values: Record<string, number>): boolean {
  const names = Object.keys(values).join('|');
  const range = text.match(new RegExp(`\\b(${names})\\s+(?:through|to|-)\\s+(${names})\\b`));
  return Boolean(range && values[range[1]] > values[range[2]]);
}

function numbersToField(values: number[]): string {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length === 0) return '*';
  if (
    unique.length > 2 &&
    unique.every((value, index) => index === 0 || value === unique[index - 1] + 1)
  ) {
    return `${unique[0]}-${unique[unique.length - 1]}`;
  }
  return unique.join(',');
}

function nameValues(names: readonly string[], offset: number): Record<string, number> {
  return Object.fromEntries(
    names.flatMap((name, index) => [
      [name.toLowerCase(), index + offset],
      [name.slice(0, 3).toLowerCase(), index + offset],
    ]),
  );
}

function uniqueTimes(values: TimeValue[]): TimeValue[] {
  return values.filter(
    (value, index) =>
      values.findIndex(
        (candidate) => candidate.hour === value.hour && candidate.minute === value.minute,
      ) === index,
  );
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[,.;!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unsupportedReason(text: string): string | null {
  if (/\b(tomorrow|today|tonight|once|next)\b/.test(text))
    return 'One-time dates are not supported by cron.';
  if (/\b(business days?|holidays?)\b/.test(text))
    return 'Business calendars are not supported by cron.';
  if (
    /\b(last|first|second|third|fourth|fifth)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      text,
    )
  ) {
    return 'Nth and last weekdays are not supported by standard cron.';
  }
  if (/\blast day of (?:the )?month\b/.test(text))
    return 'The last day of a month is not supported by standard cron.';
  return null;
}
