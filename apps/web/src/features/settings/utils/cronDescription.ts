import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  parseCron,
  type CronFields,
  type ParseResult,
} from './cronFields';

export function describeCron(expression: string): ParseResult<string> {
  const parsed = parseCron(expression);
  if (!parsed.ok) return parsed;

  const time = describeTime(parsed.value);
  const date = describeDate(parsed.value);
  return { ok: true, value: `${time}${date}` };
}

function describeTime(fields: CronFields): string {
  const minuteStep = starStep(fields.minute);
  const hourStep = starStep(fields.hour);

  if (fields.minute === '*' && fields.hour === '*') return 'Every minute';
  if (minuteStep && fields.hour === '*') return `Every ${minuteStep} minutes`;
  if (fields.minute === '0' && fields.hour === '*') return 'Every hour';
  if (fields.minute === '0' && hourStep) return `Every ${hourStep} hours`;
  if (/^\d+$/.test(fields.minute) && hourStep) {
    return `Every ${hourStep} hours at ${Number(fields.minute)} minutes past the hour`;
  }

  const minutes = numericList(fields.minute);
  const hours = numericList(fields.hour);
  if (minutes?.length === 1 && hours) {
    return `At ${joinWords(hours.map((hour) => formatTime(hour, minutes[0])))}`;
  }

  const hourRange = numericRange(fields.hour);
  const steppedHourRange = rangeStep(fields.hour);
  if (minuteStep && hourRange) {
    return `Every ${minuteStep} minutes between ${formatTime(hourRange[0], 0)} and ${formatTime(hourRange[1], 0)}`;
  }
  if (minutes?.length === 1 && hourRange) {
    return `Every hour between ${formatTime(hourRange[0], minutes[0])} and ${formatTime(hourRange[1], minutes[0])}`;
  }
  if (minutes?.length === 1 && steppedHourRange) {
    return `Every ${steppedHourRange.step} hours between ${formatTime(steppedHourRange.start, minutes[0])} and ${formatTime(steppedHourRange.end, minutes[0])}`;
  }

  return `At minute ${describeField(fields.minute)} during hour ${describeField(fields.hour)}`;
}

function describeDate(fields: CronFields): string {
  const clauses: string[] = [];

  if (fields.dayOfMonth !== '*' && fields.dayOfWeek !== '*') {
    clauses.push(
      `on ${describeOrdinals(fields.dayOfMonth)} of the month or on ${describeWeekdays(fields.dayOfWeek)}`,
    );
  } else if (fields.dayOfMonth !== '*') {
    clauses.push(`on ${describeOrdinals(fields.dayOfMonth)}`);
  } else if (fields.dayOfWeek !== '*') {
    clauses.push(`on ${describeWeekdays(fields.dayOfWeek)}`);
  }
  if (fields.month !== '*') {
    clauses.push(`in ${describeNamedField(fields.month, MONTH_NAMES)}`);
  }

  return clauses.length > 0 ? ` ${clauses.join(' ')}` : '';
}

function describeWeekdays(field: string): string {
  if (field === '1-5') return 'weekdays';
  if (field === '0,6' || field === '6,0') return 'weekends';
  return describeNamedField(field, WEEKDAY_NAMES);
}

function describeNamedField(field: string, names: readonly string[]): string {
  const values = numericList(field);
  if (values) return joinWords(values.map((value) => nameAt(value, names)));

  const range = numericRange(field);
  if (range) {
    return `${nameAt(range[0], names)} through ${nameAt(range[1], names)}`;
  }
  return describeField(field);
}

function nameAt(value: number, names: readonly string[]): string | undefined {
  if (names.length === 12) return names[value - 1];
  return names[value === 7 ? 0 : value];
}

function describeOrdinals(field: string): string {
  const values = numericList(field);
  if (values) return joinWords(values.map(ordinal));

  const range = numericRange(field);
  if (range) return `${ordinal(range[0])} through ${ordinal(range[1])}`;
  return `day ${describeField(field)}`;
}

function numericList(field: string): number[] | null {
  if (!/^\d+(?:,\d+)*$/.test(field)) return null;
  return field.split(',').map(Number);
}

function numericRange(field: string): [number, number] | null {
  const match = field.match(/^(\d+)-(\d+)$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function starStep(field: string): number | null {
  const match = field.match(/^\*\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function rangeStep(field: string): { start: number; end: number; step: number } | null {
  const match = field.match(/^(\d+)-(\d+)\/(\d+)$/);
  return match ? { start: Number(match[1]), end: Number(match[2]), step: Number(match[3]) } : null;
}

function describeField(field: string): string {
  return field.replaceAll('*', 'any').replaceAll('/', ' every ').replaceAll('-', ' through ');
}

function formatTime(hour: number, minute: number): string {
  if (hour === 0 && minute === 0) return 'midnight';
  if (hour === 12 && minute === 0) return 'noon';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function ordinal(value: number): string {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function joinWords(values: readonly (string | undefined)[]): string {
  const words = values.filter((value): value is string => Boolean(value));
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}
