import { Cron } from 'croner';
import { HttpError } from '../shared/lib';

export function nextCronRun(expression: string, from = new Date()): Date {
  try {
    const next = new Cron(expression, { timezone: 'UTC', paused: true }).nextRun(from);
    if (!next) throw new Error('Cron expression has no future run');
    return next;
  } catch {
    throw new HttpError(400, 'Invalid cron expression');
  }
}
