import { randomBytes } from 'node:crypto';
import { db, webhook, webhookDelivery } from '@repo/db';
import { and, desc, eq, lt } from 'drizzle-orm';
import { iso } from '../shared/lib';

// Outgoing webhook subscriptions on a project. A subscription targets a `url`,
// carries a per-subscription `secret` used to sign delivered payloads, and lists
// the event types it wants. Delivery is handled separately; this layer only
// stores and returns the subscription.

// The event types a subscription can listen to. Keep in sync with the events the
// delivery side emits (issues/store.ts, issues/activity.ts) and the frontend list
// (apps/web src/lib/api.ts). issue.updated fires on any field change; the granular
// issue.assigned / issue.state_changed / issue.label_changed fire in addition,
// only when that specific field changes on an existing issue. issue.state_changed
// fires when the issue moves to a different state (column).
export const WEBHOOK_EVENT_TYPES = [
  'issue.created',
  'issue.updated',
  'issue.deleted',
  'issue.assigned',
  'issue.state_changed',
  'issue.label_changed',
  'comment.created',
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface WebhookRow {
  id: number;
  projectId: number;
  url: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  createdAt: string;
}

function mapWebhook(row: typeof webhook.$inferSelect): WebhookRow {
  return {
    id: row.id,
    projectId: row.projectId,
    url: row.url,
    secret: row.secret,
    events: (row.events as WebhookEventType[]) ?? [],
    isActive: row.isActive,
    createdAt: iso(row.createdAt),
  };
}

// A signing secret for a new subscription. Shown to the client so it can verify
// delivered payloads; generated server-side and never derived from user input.
function generateSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

export async function listWebhooks(projectId: number): Promise<WebhookRow[]> {
  const rows = await db
    .select()
    .from(webhook)
    .where(eq(webhook.projectId, projectId))
    .orderBy(webhook.id);
  return rows.map(mapWebhook);
}

export async function createWebhook(input: {
  projectId: number;
  url: string;
  events: WebhookEventType[];
  isActive?: boolean;
}): Promise<WebhookRow> {
  const [row] = await db
    .insert(webhook)
    .values({
      projectId: input.projectId,
      url: input.url,
      secret: generateSecret(),
      events: input.events,
      isActive: input.isActive ?? true,
    })
    .returning();
  return mapWebhook(row);
}

export async function getWebhook(id: number): Promise<WebhookRow | null> {
  const rows = await db.select().from(webhook).where(eq(webhook.id, id));
  return rows[0] ? mapWebhook(rows[0]) : null;
}

// Updates only the provided fields. The secret is not user-editable here.
export async function updateWebhook(
  id: number,
  patch: { url?: string; events?: WebhookEventType[]; isActive?: boolean },
): Promise<WebhookRow | null> {
  const set: Partial<typeof webhook.$inferInsert> = {};
  if (patch.url !== undefined) set.url = patch.url;
  if (patch.events !== undefined) set.events = patch.events;
  if (patch.isActive !== undefined) set.isActive = patch.isActive;
  if (Object.keys(set).length === 0) return getWebhook(id);
  const [row] = await db.update(webhook).set(set).where(eq(webhook.id, id)).returning();
  return row ? mapWebhook(row) : null;
}

export async function deleteWebhook(id: number): Promise<void> {
  await db.delete(webhook).where(eq(webhook.id, id));
}

// --- Delivery history ------------------------------------------------------------

export interface WebhookDeliveryRow {
  id: number;
  eventId: string;
  eventType: string;
  status: string;
  attempts: number;
  // The payload we sent (the request body), for the "sent" view.
  payload: unknown;
  responseStatus: number | null;
  responseBody: string | null;
  lastError: string | null;
  nextAttemptAt: string;
  createdAt: string;
}

export interface WebhookDeliveryPage {
  items: WebhookDeliveryRow[];
  // The id to pass as `before` to load the next page, or null when at the end.
  nextCursor: number | null;
}

function mapDelivery(row: typeof webhookDelivery.$inferSelect): WebhookDeliveryRow {
  return {
    id: row.id,
    eventId: row.eventId,
    eventType: row.eventType,
    status: row.status,
    attempts: row.attempts,
    payload: row.payload,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
    lastError: row.lastError,
    nextAttemptAt: iso(row.nextAttemptAt),
    createdAt: iso(row.createdAt),
  };
}

// One page of the webhook's deliveries, newest first. Keyset pagination by id
// (deliveries are id-monotonic): pass the previous page's nextCursor as `before`
// to get the next page. limit is clamped to 1..50.
export async function listWebhookDeliveries(
  webhookId: number,
  opts: { before?: number; limit?: number } = {},
): Promise<WebhookDeliveryPage> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 50);
  const rows = await db
    .select()
    .from(webhookDelivery)
    .where(
      and(
        eq(webhookDelivery.webhookId, webhookId),
        opts.before ? lt(webhookDelivery.id, opts.before) : undefined,
      ),
    )
    .orderBy(desc(webhookDelivery.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map(mapDelivery),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
