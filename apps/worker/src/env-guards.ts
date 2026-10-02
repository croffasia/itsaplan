// Startup checks for env pairs that would re-claim a delivery still being sent.

import { intEnv } from './env';
import { workerConfig } from './config';

// Telegram and Resend cap a send around 15s. SMTP can be longer (and is configured in
// the DB, not here); this floor only covers the built-in HTTP paths.
const NOTIFICATION_SEND_BUDGET_MS = 30_000;

export function assertLeaseExceedsMs(
  leaseSeconds: number,
  minMs: number,
  leaseEnv: string,
  reason: string,
): void {
  if (leaseSeconds * 1000 > minMs) return;
  throw new Error(
    `${leaseEnv}=${leaseSeconds}s must exceed ${reason} (${minMs}ms); ` +
      `otherwise another worker reclaims the row mid-flight`,
  );
}

export function assertWorkerLeaseEnv(): void {
  const cfg = workerConfig();
  assertLeaseExceedsMs(
    cfg.leaseSeconds,
    cfg.timeoutMs,
    'WEBHOOK_LEASE_SECONDS',
    'WEBHOOK_TIMEOUT_MS',
  );
  assertLeaseExceedsMs(
    intEnv('NOTIFICATION_LEASE_SECONDS', 120),
    NOTIFICATION_SEND_BUDGET_MS,
    'NOTIFICATION_LEASE_SECONDS',
    'the notification send budget',
  );
}
