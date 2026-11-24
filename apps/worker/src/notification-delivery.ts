import { db, notificationDelivery, type DeliveryPayload, type JobSettings } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { equalJitterBackoffMs } from './backoff';
import { deliverNotification, type SendResult } from './notification-send';

// Drains the notification_delivery outbox: claims due rows and sends each one.
// Follows the same claim/retry pattern as webhook delivery. A succeeded row is
// deleted (no delivery history is kept); a permanently failed row is left as
// 'failed' with its last error for debugging.

interface ClaimedNotification {
  id: number;
  projectId: number;
  channel: string;
  recipient: string | null;
  payload: DeliveryPayload;
  attempts: number;
}

type NotificationJobs = JobSettings['notifications'];

export async function processNotificationDeliveries(jobs: NotificationJobs): Promise<void> {
  const claimed = await claimDueDeliveries(jobs);
  await Promise.all(claimed.map((d) => processDelivery(d, jobs.maxAttempts)));
}

// Atomically claims up to the batch size of due rows. FOR UPDATE SKIP LOCKED lets
// multiple worker replicas run without grabbing the same row; the claim leases the
// row by pushing next_attempt_at forward, so a row whose worker crashes mid-send
// becomes claimable again after the lease.
async function claimDueDeliveries({
  batchSize,
  leaseSeconds,
}: NotificationJobs): Promise<ClaimedNotification[]> {
  const rows = await db.execute(sql`
    UPDATE notification_delivery d
    SET attempts = d.attempts + 1,
        next_attempt_at = now() + make_interval(secs => ${leaseSeconds})
    WHERE d.id IN (
      SELECT id FROM notification_delivery
      WHERE status = 'pending' AND next_attempt_at <= now()
      ORDER BY next_attempt_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    RETURNING
      d.id,
      d.project_id AS "projectId",
      d.channel,
      d.recipient,
      d.payload,
      d.attempts
  `);
  return rows as unknown as ClaimedNotification[];
}

async function processDelivery(d: ClaimedNotification, maxAttempts: number): Promise<void> {
  let result: SendResult;
  try {
    result = await deliverNotification(d);
  } catch (err) {
    result = {
      ok: false,
      retryable: true,
      error: err instanceof Error ? err.message : 'send failed',
    };
  }

  if (result.ok) {
    await db.delete(notificationDelivery).where(eq(notificationDelivery.id, d.id));
    return;
  }

  const error = (result.error ?? 'delivery failed').slice(0, 500);
  if (result.retryable && d.attempts < maxAttempts) {
    const delaySeconds = Math.ceil(equalJitterBackoffMs(d.attempts, 30_000, 30 * 60_000) / 1000);
    await db
      .update(notificationDelivery)
      .set({ nextAttemptAt: sql`now() + make_interval(secs => ${delaySeconds})`, lastError: error })
      .where(eq(notificationDelivery.id, d.id));
    return;
  }
  await db
    .update(notificationDelivery)
    .set({ status: 'failed', lastError: error })
    .where(eq(notificationDelivery.id, d.id));
}
