import { workerConfig } from './config';
import { deliver } from './delivery';
import { processNotificationDeliveries } from './notification-delivery';
import { equalJitterBackoffMs } from './backoff';
import { startPollLoop, type WorkerHandle } from './poll-loop';
import {
  type ClaimedDelivery,
  claimDueDeliveries,
  markSuccess,
  scheduleRetry,
  markFailed,
  markSkippedInactive,
  cleanupOldDeliveries,
  archiveStaleIssues,
} from './store';

let ticksSinceCleanup = 0;
let ticksSinceAutoArchive = 0;

export function startWorker(): WorkerHandle {
  return startPollLoop('worker', tick, () => workerConfig().pollIntervalMs);
}

// One poll: claim a batch of due deliveries, send them concurrently, record each
// outcome, then run the delivery cleanup and the auto-archive sweep on their own
// tick intervals.
async function tick(): Promise<void> {
  const cfg = workerConfig();
  const claimed = await claimDueDeliveries();
  if (claimed.length > 0) {
    await Promise.all(claimed.map(processDelivery));
  }
  await processNotificationDeliveries();
  if (++ticksSinceCleanup >= cfg.cleanupEveryTicks) {
    ticksSinceCleanup = 0;
    const removed = await cleanupOldDeliveries();
    if (removed > 0) console.log(`[worker] cleaned up ${removed} old deliveries`);
  }
  if (++ticksSinceAutoArchive >= cfg.autoArchiveEveryTicks) {
    ticksSinceAutoArchive = 0;
    const archived = await archiveStaleIssues();
    if (archived > 0) console.log(`[worker] auto-archived ${archived} stale issues`);
  }
}

async function processDelivery(d: ClaimedDelivery): Promise<void> {
  const cfg = workerConfig();
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
