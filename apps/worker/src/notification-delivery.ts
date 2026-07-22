import { db, notificationDelivery } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { equalJitterBackoffMs } from './backoff';
import { intEnv } from './env';
import { postInternal } from './internal-api';

// Drains the notification_delivery outbox: claims due rows and asks the API to send
// each one. Follows the same claim/retry pattern as webhook delivery, but the send
// itself runs in the API (POST /internal/notification-deliveries/send) because the
// channel credentials are encrypted with the API's key — the worker never decrypts.
// A succeeded row is deleted (no delivery history is kept); a permanently failed row
// is left as 'failed' with its last error for debugging.

interface ClaimedNotification {
  id: number;
  projectId: number;
  channel: string;
  recipient: string | null;
  payload: unknown;
  attempts: number;
}

interface SendResult {
  ok: boolean;
  retryable?: boolean;
  error?: string;
}

export async function processNotificationDeliveries(): Promise<void> {
  const claimed = await claimDueDeliveries();
  await Promise.all(claimed.map(processDelivery));
}

// Atomically claims up to the batch size of due rows. FOR UPDATE SKIP LOCKED lets
// multiple worker replicas run without grabbing the same row; the claim leases the
// row by pushing next_attempt_at forward, so a row whose worker crashes mid-send
// becomes claimable again after the lease.
async function claimDueDeliveries(): Promise<ClaimedNotification[]> {
  const batchSize = intEnv('NOTIFICATION_BATCH_SIZE', 20);
  const leaseSeconds = intEnv('NOTIFICATION_LEASE_SECONDS', 120);
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

async function processDelivery(d: ClaimedNotification): Promise<void> {
  let result: SendResult;
  try {
    result = await send(d);
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

  const maxAttempts = intEnv('NOTIFICATION_MAX_ATTEMPTS', 5);
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

// Calls the API to actually deliver the message.
async function send(d: ClaimedNotification): Promise<SendResult> {
  const res = await postInternal(
    '/internal/notification-deliveries/send',
    {
      projectId: d.projectId,
      channel: d.channel,
      recipient: d.recipient,
      payload: d.payload,
    },
    intEnv('NOTIFICATION_TIMEOUT_MS', 20_000),
  );
  const body = (await res.json().catch(() => null)) as SendResult | null;
  if (!res.ok) {
    return { ok: false, retryable: res.status >= 500, error: `send API returned ${res.status}` };
  }
  return body ?? { ok: false, retryable: true, error: 'empty send response' };
}
