// Worker tuning, read from the environment once behind a lazy getter so env is
// loaded (via --env-file / the container env) before it is read. Every value has
// a sane default, so the worker runs with only DATABASE_URL set (validated by
// @repo/db's client).

import { intEnv } from './env';

export interface WorkerConfig {
  // How often to poll for due deliveries.
  pollIntervalMs: number;
  // Max deliveries claimed and sent per tick (also the concurrency ceiling).
  batchSize: number;
  // Per-delivery HTTP timeout.
  timeoutMs: number;
  // After this many attempts a failing delivery is marked failed (dead-letter).
  maxAttempts: number;
  // After this many consecutive failures a webhook is auto-disabled.
  disableThreshold: number;
  // How long a claimed row is leased before it becomes claimable again (crash
  // recovery). Must exceed timeoutMs comfortably.
  leaseSeconds: number;
  // Succeeded deliveries older than this are deleted by the periodic cleanup.
  cleanupDays: number;
  // Run the cleanup once every this many ticks.
  cleanupEveryTicks: number;
  // Run the auto-archive sweep once every this many ticks. Archiving is not time-
  // sensitive (an issue past its threshold can wait a tick), so this is coarse.
  autoArchiveEveryTicks: number;
  // How often to look for tracked social accounts that need a check. The tick
  // cadence only decides how often we look; competitorIntervalMs decides which
  // accounts are actually due, so looking often is cheap.
  competitorEveryTicks: number;
  // How old an account's last check must be before it is checked again.
  competitorIntervalMs: number;
  // Max accounts checked per sweep. Each one is an outbound API call, so this
  // caps how long a sweep holds the api busy.
  competitorBatchSize: number;
  // Alerts older than this are deleted by the sweep.
  competitorRetainDays: number;
  // Timeout for the sweep call itself; it checks a whole batch, so it is generous.
  competitorTimeoutMs: number;
}

let cached: WorkerConfig | null = null;

export function workerConfig(): WorkerConfig {
  if (cached) return cached;
  cached = {
    pollIntervalMs: intEnv('WEBHOOK_POLL_INTERVAL_MS', 2000),
    batchSize: intEnv('WEBHOOK_BATCH_SIZE', 20),
    timeoutMs: intEnv('WEBHOOK_TIMEOUT_MS', 10_000),
    maxAttempts: intEnv('WEBHOOK_MAX_ATTEMPTS', 8),
    disableThreshold: intEnv('WEBHOOK_DISABLE_THRESHOLD', 20),
    leaseSeconds: intEnv('WEBHOOK_LEASE_SECONDS', 120),
    cleanupDays: intEnv('WEBHOOK_CLEANUP_DAYS', 30),
    cleanupEveryTicks: intEnv('WEBHOOK_CLEANUP_EVERY_TICKS', 300),
    // Default ~1h at the 2s poll interval (1800 ticks).
    autoArchiveEveryTicks: intEnv('AUTO_ARCHIVE_EVERY_TICKS', 1800),
    // Default ~5m at the 2s poll interval (150 ticks).
    competitorEveryTicks: intEnv('COMPETITOR_EVERY_TICKS', 150),
    competitorIntervalMs: intEnv('COMPETITOR_INTERVAL_MS', 2 * 60 * 60 * 1000),
    competitorBatchSize: intEnv('COMPETITOR_BATCH_SIZE', 20),
    competitorRetainDays: intEnv('COMPETITOR_RETAIN_DAYS', 60),
    competitorTimeoutMs: intEnv('COMPETITOR_TIMEOUT_MS', 120_000),
  };
  return cached;
}
