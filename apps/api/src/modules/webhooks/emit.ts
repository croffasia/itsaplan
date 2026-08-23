import { randomUUID } from 'node:crypto';
import { db, webhook, webhookDelivery } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import type { WebhookEventType } from './service';

// Maps our granular event type to the Linear-style envelope's action + resource
// type. action is create | update | remove. type is the PascalCase resource.
// Linear's action/type pair cannot distinguish our assigned, state_changed, and
// label_changed variants, because all of them are an issue update. The payload keeps
// the granular event in its own `event` field.
const EVENT_SHAPE: Record<WebhookEventType, { action: string; type: string }> = {
  'issue.created': { action: 'create', type: 'Issue' },
  'issue.updated': { action: 'update', type: 'Issue' },
  'issue.deleted': { action: 'remove', type: 'Issue' },
  'issue.assigned': { action: 'update', type: 'Issue' },
  'issue.state_changed': { action: 'update', type: 'Issue' },
  'issue.label_changed': { action: 'update', type: 'Issue' },
  'issue.link_changed': { action: 'update', type: 'Issue' },
  'comment.created': { action: 'create', type: 'Comment' },
};

// Fan-out for outgoing webhooks. Queues one delivery per active webhook of the
// project that subscribes to eventType. The deliveries share one eventId, which stays
// the same across retries so a receiver can deduplicate. Call it right after a domain
// mutation, next to the activity log, the same way the issue service handles its other
// post-write side effects. It does nothing when no webhook matches, so a project with
// no webhooks pays one indexed SELECT.
//
// The body follows Linear's webhook envelope: top-level action, type, data, plus
// createdAt and webhookTimestamp (epoch ms). `event` is our extension, and it carries
// the granular event type. We omit organizationId and url, because there is no
// organization concept and issues have no public URL. The shared dedup id goes in the
// X-Itsaplan-Event-Id header, not in the body.
export async function emitWebhookEvent(
  projectId: number,
  eventType: WebhookEventType,
  data: unknown,
): Promise<void> {
  await emitWebhookEvents(projectId, eventType, () => Promise.resolve([data]));
}

// Several events of one type at once. It builds the payloads only after it finds a
// subscribed webhook. Use it for a write whose payload costs its own queries to
// build: linking two issues has to load both of them. A project with no webhook then
// pays one indexed SELECT and nothing else. Each event gets its own eventId. The
// deliveries go in as one insert.
export async function emitWebhookEvents(
  projectId: number,
  eventType: WebhookEventType,
  load: () => Promise<unknown[]>,
): Promise<void> {
  const matching = await db
    .select({ id: webhook.id })
    .from(webhook)
    .where(
      and(
        eq(webhook.projectId, projectId),
        eq(webhook.isActive, true),
        // events is a jsonb array of event-type strings. @> tests membership.
        sql`${webhook.events} @> ${JSON.stringify([eventType])}::jsonb`,
      ),
    );
  if (matching.length === 0) return;

  const payloads = await load();
  if (payloads.length === 0) return;

  const { action, type } = EVENT_SHAPE[eventType];
  const now = new Date();
  const createdAt = now.toISOString();
  const webhookTimestamp = now.getTime();

  await db.insert(webhookDelivery).values(
    payloads.flatMap((data) => {
      const eventId = randomUUID();
      return matching.map((h) => ({
        webhookId: h.id,
        eventId,
        eventType,
        payload: {
          action,
          type,
          event: eventType,
          createdAt,
          data,
          webhookTimestamp,
          webhookId: h.id,
        },
      }));
    }),
  );
}
