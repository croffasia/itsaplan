import { equalJitterBackoffMs } from './backoff';
import { SourceRateLimitedError } from './reader';

// import-store.ts resets job.attempts to 0 on every tick that makes progress, so
// this counts consecutive failed ticks: a long import does not fail itself out.
export const MAX_ATTEMPTS = 10;

// SettingsImportExportJobRow.tsx (apps/web) matches this exact last_error.
const RATE_LIMITED = 'rate limited';

export type TickErrorOutcome =
  { action: 'retry'; delayMs: number; lastError: string } | { action: 'fail'; lastError: string };

export function tickErrorOutcome(error: unknown, attempts: number): TickErrorOutcome {
  if (error instanceof SourceRateLimitedError) {
    return { action: 'retry', delayMs: error.retryAfterMs, lastError: RATE_LIMITED };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (attempts >= MAX_ATTEMPTS) return { action: 'fail', lastError: message };
  return { action: 'retry', delayMs: equalJitterBackoffMs(attempts), lastError: message };
}
