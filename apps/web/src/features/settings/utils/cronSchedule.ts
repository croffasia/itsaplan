import { describeCron } from './cronDescription';
import { formatCron, parseCron } from './cronFields';
import { parseCronText } from './cronTextParser';

export type ScheduleInputResult =
  | { ok: true; source: 'cron' | 'text'; cron: string; description: string }
  | { ok: false; error: string };

export function parseScheduleInput(input: string): ScheduleInputResult {
  const value = input.trim();
  if (!value) return { ok: false, error: 'Enter a schedule.' };

  const source = looksLikeCron(value) ? 'cron' : 'text';
  let cron: string;
  if (source === 'cron') {
    const parsed = parseCron(value);
    if (!parsed.ok) return parsed;
    cron = formatCron(parsed.value);
  } else {
    const parsed = parseCronText(value);
    if (!parsed.ok) return parsed;
    cron = parsed.value;
  }

  const description = describeCron(cron);
  if (!description.ok) return description;

  return { ok: true, source, cron, description: description.value };
}

function looksLikeCron(value: string): boolean {
  const parts = value.split(/\s+/);
  return parts.length === 5 && /^[\d*/,-]+$/.test(parts[0]);
}
