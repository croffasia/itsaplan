import { HttpError } from '#shared/lib';

export const AI_ASSIST_CALLS_PER_HOUR = 20;
const WINDOW_MS = 60 * 60 * 1000;

// Per process: with several api replicas each one counts on its own.
const calls = new Map<string, number[]>();

export function takeAiAssistCall(userId: string, now = Date.now()): void {
  const recent = (calls.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= AI_ASSIST_CALLS_PER_HOUR) {
    calls.set(userId, recent);
    throw new HttpError(
      429,
      `AI assist allows ${AI_ASSIST_CALLS_PER_HOUR} drafts per hour. Try again later.`,
    );
  }
  recent.push(now);
  calls.set(userId, recent);
}
