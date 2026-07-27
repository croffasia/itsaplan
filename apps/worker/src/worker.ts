import { workerConfig } from './config';
import { deliver } from './delivery';
import { processNotificationDeliveries } from './notification-delivery';
import { equalJitterBackoffMs } from './backoff';
import { deleteIssueAgentThreads } from './agent-runs';
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
  archiveStaleIssues,
} from './store';

let ticksSinceCleanup = 0;
let ticksSinceAutoArchive = 0;
// Starts due, so an install is visible even if the instance is removed minutes later.
let ticksSinceTelemetry = TELEMETRY_CHECK_EVERY_TICKS;

export function startWorker(): WorkerHandle {
  return startPollLoop('worker', tick, () => workerConfig().pollIntervalMs);
}

// One poll: claim a batch of due deliveries, send them concurrently, record each
// outcome, then run the delivery cleanup, the auto-archive sweep and the telemetry
// check on their own tick intervals.
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
    if (archived.length > 0) {
      console.log(`[worker] auto-archived ${archived.length} stale issues`);
      // An unreachable api must not read as a failed tick: the issues are archived
      // either way, and their threads then stay until the agent or project goes.
      try {
        await deleteIssueAgentThreads(archived);
      } catch (error) {
        console.error('[worker] deleting agent threads of archived issues failed:', error);
      }
    }
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
