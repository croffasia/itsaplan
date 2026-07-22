import { db, webhook, webhookDelivery } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { workerConfig } from './config';

export interface ClaimedDelivery {
  id: number;
  webhookId: number;
  eventId: string;
  eventType: string;
  payload: unknown;
  attempts: number;
  url: string;
  secret: string;
  isActive: boolean;
}

// Atomically claims up to batchSize due deliveries. FOR UPDATE SKIP LOCKED lets
// multiple worker replicas run without ever grabbing the same row. Claiming
// pushes next_attempt_at forward by the lease and bumps attempts, so a row whose
// worker crashes mid-delivery becomes claimable again after the lease — no
// separate recovery pass. The webhook's url/secret/is_active are read inline.
export async function claimDueDeliveries(): Promise<ClaimedDelivery[]> {
  const { batchSize, leaseSeconds } = workerConfig();
  const rows = await db.execute(sql`
    UPDATE webhook_delivery d
    SET attempts = d.attempts + 1,
        next_attempt_at = now() + make_interval(secs => ${leaseSeconds})
    WHERE d.id IN (
      SELECT id FROM webhook_delivery
      WHERE status = 'pending' AND next_attempt_at <= now()
      ORDER BY next_attempt_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    RETURNING
      d.id,
      d.webhook_id AS "webhookId",
      d.event_id AS "eventId",
      d.event_type AS "eventType",
      d.payload,
      d.attempts,
      (SELECT url FROM webhook w WHERE w.id = d.webhook_id) AS url,
      (SELECT secret FROM webhook w WHERE w.id = d.webhook_id) AS secret,
      (SELECT is_active FROM webhook w WHERE w.id = d.webhook_id) AS "isActive"
  `);
  return rows as unknown as ClaimedDelivery[];
}

// The receiver's response recorded for the history view. Absent on a network or
// timeout error (no response arrived).
export interface DeliveryResponse {
  status?: number;
  body?: string;
}

export async function markSuccess(
  deliveryId: number,
  webhookId: number,
  response: DeliveryResponse,
): Promise<void> {
  await db
    .update(webhookDelivery)
    .set({
      status: 'success',
      lastError: null,
      responseStatus: response.status ?? null,
      responseBody: response.body ?? null,
    })
    .where(eq(webhookDelivery.id, deliveryId));
  await db.update(webhook).set({ consecutiveFailures: 0 }).where(eq(webhook.id, webhookId));
}

export async function scheduleRetry(
  deliveryId: number,
  webhookId: number,
  delayMs: number,
  error: string,
  response: DeliveryResponse,
): Promise<void> {
  const delaySeconds = Math.max(1, Math.ceil(delayMs / 1000));
  await db
    .update(webhookDelivery)
    .set({
      status: 'pending',
      nextAttemptAt: sql`now() + make_interval(secs => ${delaySeconds})`,
      lastError: error.slice(0, 500),
      responseStatus: response.status ?? null,
      responseBody: response.body ?? null,
    })
    .where(eq(webhookDelivery.id, deliveryId));
  await bumpWebhookFailure(webhookId);
}

export async function markFailed(
  deliveryId: number,
  webhookId: number,
  error: string,
  response: DeliveryResponse,
): Promise<void> {
  await db
    .update(webhookDelivery)
    .set({
      status: 'failed',
      lastError: error.slice(0, 500),
      responseStatus: response.status ?? null,
      responseBody: response.body ?? null,
    })
    .where(eq(webhookDelivery.id, deliveryId));
  await bumpWebhookFailure(webhookId);
}

// A delivery claimed for a webhook that is no longer active (auto-disabled or
// disabled by a user after the row was queued). Drop it without counting another
// failure against the already-disabled webhook.
export async function markSkippedInactive(deliveryId: number): Promise<void> {
  await db
    .update(webhookDelivery)
    .set({ status: 'failed', lastError: 'webhook disabled' })
    .where(eq(webhookDelivery.id, deliveryId));
}

// Increments the webhook's consecutive-failure counter and auto-disables it once
// the counter reaches the threshold, in one statement.
async function bumpWebhookFailure(webhookId: number): Promise<void> {
  const { disableThreshold } = workerConfig();
  await db
    .update(webhook)
    .set({
      consecutiveFailures: sql`${webhook.consecutiveFailures} + 1`,
      isActive: sql`(${webhook.consecutiveFailures} + 1) < ${disableThreshold}`,
    })
    .where(eq(webhook.id, webhookId));
}

// Deletes succeeded deliveries older than the cleanup window. Best-effort; returns
// the number removed.
export async function cleanupOldDeliveries(): Promise<number> {
  const { cleanupDays } = workerConfig();
  const res = await db.execute(sql`
    DELETE FROM webhook_delivery
    WHERE status = 'success' AND created_at < now() - make_interval(days => ${cleanupDays})
  `);
  return (res as unknown as { count?: number }).count ?? 0;
}

// Auto-archive sweep: archives active issues that have sat inactive in a
// completed/canceled column past their project's configured threshold. The
// threshold lives in project_setting under key 'auto_archive' as
// { completedDays, canceledDays }; a positive day count enables archiving for that
// state group, null/absent disables it (kept in sync with getAutoArchiveSettings in
// apps/api/src/projects/store.ts). Inactivity is measured by issue.updated_at:
// moving to a terminal column bumps it, and any later edit resets the clock, so an
// issue is archived only after the full period with no activity. The ->> is guarded
// by a numeric-string regex so a malformed or missing value is treated as disabled,
// never cast. Returns the number archived. Idempotent (archived_at IS NULL filter).
export async function archiveStaleIssues(): Promise<number> {
  const res = await db.execute(sql`
    UPDATE issue i
    SET archived_at = now()
    FROM project_column c, project_setting s
    WHERE i.column_id = c.id
      AND i.project_id = s.project_id
      AND s.key = 'auto_archive'
      AND i.archived_at IS NULL
      AND (
        (c.state_type = 'completed'
          AND (s.value->>'completedDays') ~ '^[0-9]+$'
          AND i.updated_at < now() - make_interval(days => (s.value->>'completedDays')::int))
        OR
        (c.state_type = 'canceled'
          AND (s.value->>'canceledDays') ~ '^[0-9]+$'
          AND i.updated_at < now() - make_interval(days => (s.value->>'canceledDays')::int))
      )
  `);
  return (res as unknown as { count?: number }).count ?? 0;
}
