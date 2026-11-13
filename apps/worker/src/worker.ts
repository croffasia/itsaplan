import { getJobSettings, type JobSettings } from '@repo/db';
import { deliver } from './delivery';
import { processNotificationDeliveries } from './notification-delivery';
import { equalJitterBackoffMs } from './backoff';
import { startPollLoop, type WorkerHandle } from './poll-loop';
import { TELEMETRY_CHECK_EVERY_TICKS, processTelemetry } from './telemetry';
import {
  type ClaimedDelivery,
  claimDueDeliveries,
  markSuccess,
  scheduleRetry,
  markFailed,
  markSkippedInactive,
  cleanupOldDeliveries,
} from './store';

let lastCleanupAt = Date.now();
// Starts due, so an install is visible even if the instance is removed minutes later.
let ticksSinceTelemetry = TELEMETRY_CHECK_EVERY_TICKS;

export function startWorker(): WorkerHandle {
  return startPollLoop('worker', tick, (jobs) => jobs.webhooks.pollIntervalMs);
}

// One poll: claim a batch of due deliveries, send them concurrently, record each
// outcome, then run the delivery cleanup and the telemetry check when they are due.
async function tick(): Promise<void> {
  const { webhooks, notifications } = await getJobSettings();
  const claimed = await claimDueDeliveries(webhooks);
  if (claimed.length > 0) {
    await Promise.all(claimed.map((d) => processDelivery(d, webhooks)));
  }
  await processNotificationDeliveries(notifications);
  if (Date.now() - lastCleanupAt >= webhooks.cleanupIntervalMinutes * 60_000) {
    lastCleanupAt = Date.now();
    const removed = await cleanupOldDeliveries(webhooks.retentionDays);
    if (removed > 0) console.log(`[worker] cleaned up ${removed} old deliveries`);
  }
  if (++ticksSinceTelemetry >= TELEMETRY_CHECK_EVERY_TICKS) {
    ticksSinceTelemetry = 0;
    // An unreachable collector must not read as a failed tick.
    try {
      await processTelemetry();
    } catch (error) {
      console.error('[worker] telemetry send failed:', error);
    }
  }
}

async function processDelivery(d: ClaimedDelivery, cfg: JobSettings['webhooks']): Promise<void> {
  if (!d.isActive) {
    await markSkippedInactive(d.id);
    return;
  }
  const body = JSON.stringify(d.payload);
  const result = await deliver({
    url: d.url,
    secret: d.secret,
    deliveryId: d.id,
    eventId: d.eventId,
    eventType: d.eventType,
    body,
    timeoutMs: cfg.timeoutMs,
  });
  const response = { status: result.status, body: result.responseBody };
  if (result.ok) {
    await markSuccess(d.id, d.webhookId, response);
    return;
  }
  if (result.retryable && d.attempts < cfg.maxAttempts) {
    await scheduleRetry(
      d.id,
      d.webhookId,
      equalJitterBackoffMs(d.attempts),
      result.error ?? 'delivery failed',
      response,
    );
    return;
  }
  await markFailed(d.id, d.webhookId, result.error ?? 'delivery failed', response);
}
