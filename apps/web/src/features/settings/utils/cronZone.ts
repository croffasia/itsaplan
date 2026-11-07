import { zoneOffsetMs } from '@/utils/dates';
import { describeCron } from './cronDescription';
import { formatCron, parseCron } from './cronFields';

const MINUTES_A_DAY = 24 * 60;
const DAYS_A_WEEK = 7;

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function ascending(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

// The values a field of numbers, ranges and steps stands for. Null for a field with a star.
function valuesOf(field: string, max: number): number[] | null {
  if (field.includes('*')) return null;
  return field.split(',').flatMap((segment) => {
    const [base, step] = segment.split('/');
    const [from, to = step ? max : from] = base.split('-').map(Number);
    const values: number[] = [];
    for (let value = from; value <= to; value += Number(step ?? 1)) values.push(value);
    return values;
  });
}

function hourField(hours: number[], wasRange: boolean): string {
  const unbroken = hours.every((hour, index) => index === 0 || hour === hours[index - 1] + 1);
  return wasRange && unbroken && hours.length > 1
    ? `${hours[0]}-${hours[hours.length - 1]}`
    : hours.join(',');
}

// A UTC cron as it falls in the display zone, at the offset the zone has at `at`, so it follows
// the zone's clock changes. Null when one cron cannot show that, or today's offset may not hold:
// - the schedule names a month, whose offset may differ from today's;
// - the time moves to another day of the month, or its times fall on different days;
// - the zone is off the hour and the cron has no one minute;
// - the cron has no hours of its own and names a day, or a minute in a zone off the hour.
export function cronInDisplayZone(cron: string, at = new Date()): string | null {
  const parsed = parseCron(cron);
  if (!parsed.ok) return null;
  const { minute, hour, dayOfMonth, month, dayOfWeek } = parsed.value;
  if (month !== '*') return null;

  const offset = Math.round(zoneOffsetMs(at) / 60_000);
  const onTheHour = offset % 60 === 0;
  const everyDay = dayOfMonth === '*' && dayOfWeek === '*';
  const hours = valuesOf(hour, 23);
  if (!hours) {
    return everyDay && (onTheHour || minute.includes('*')) ? formatCron(parsed.value) : null;
  }
  const oneMinute = /^\d+$/.test(minute);
  if (!oneMinute && !onTheHour) return null;

  const times = hours.map((value) => value * 60 + (oneMinute ? Number(minute) : 0) + offset);
  const inDay = times.map((time) => modulo(time, MINUTES_A_DAY));
  const fields = {
    ...parsed.value,
    minute: oneMinute ? String(inDay[0] % 60) : minute,
    hour: hourField(ascending(inDay.map((time) => Math.floor(time / 60))), hour.includes('-')),
  };
  if (everyDay) return formatCron(fields);

  const days = new Set(times.map((time) => Math.floor(time / MINUTES_A_DAY)));
  if (days.size > 1) return null;
  const [daysMoved] = days;
  if (daysMoved === 0) return formatCron(fields);
  if (dayOfMonth !== '*') return null;
  const weekdays = valuesOf(dayOfWeek, DAYS_A_WEEK - 1);
  if (!weekdays) return null;
  const moved = weekdays.map((day) => modulo(day + daysMoved, DAYS_A_WEEK));
  return formatCron({ ...fields, dayOfWeek: ascending(moved).join(',') });
}

// A UTC cron's description in the display zone, or null when `cronInDisplayZone` is.
export function describeCronInDisplayZone(cron: string): string | null {
  const zoned = cronInDisplayZone(cron);
  const description = zoned ? describeCron(zoned) : null;
  return description?.ok ? description.value : null;
}
