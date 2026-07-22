import { randomUUID } from 'node:crypto';
import { db, webhook, webhookDelivery } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import type { WebhookEventType } from './store';

// Maps our granular event type to the Linear-style envelope's action + resource
// type. action is create | update | remove; type is the PascalCase resource.
// Linear's action/type pair cannot distinguish our assigned / state_changed /
// label_changed variants (all of them are an issue update), so the granular event
// is kept in the payload's `event` field.
const EVENT_SHAPE: Record<WebhookEventType, { action: string; type: string }> = {
  'issue.created': { action: 'create', type: 'Issue' },
  'issue.updated': { action: 'update', type: 'Issue' },
  'issue.deleted': { action: 'remove', type: 'Issue' },
  'issue.assigned': { action: 'update', type: 'Issue' },
  'issue.state_changed': { action: 'update', type: 'Issue' },
  'issue.label_changed': { action: 'update', type: 'Issue' },
  'comment.created': { action: 'create', type: 'Comment' },
};

// Fan-out for outgoing webhooks: queues one delivery per active webhook of the
// project that is subscribed to eventType, all sharing a single eventId (stable
// across retries so receivers can deduplicate). Called right after a domain
// mutation, next to the activity log, following the same post-write side-effect
// pattern the issue store already uses. No-op when no webhook matches, so it costs
// one indexed SELECT on projects with no webhooks.
//
// The body follows Linear's webhook envelope: top-level action, type, data, plus
// createdAt and webhookTimestamp (epoch ms). `event` is our extension carrying the
// granular event type. organizationId and url are omitted (there is no organization
// concept, and issues have no public URL). The shared dedup id rides on the wire in
// the X-Itsaplan-Event-Id header, not the body.
export async function emitWebhookEvent(
  projectId: number,
  eventType: WebhookEventType,
  data: unknown,
): Promise<void> {
  const matching = await db
    .select({ id: webhook.id })
    .from(webhook)
    .where(
      and(
        eq(webhook.projectId, projectId),
        eq(webhook.isActive, true),
        // events is a jsonb array of event-type strings; @> tests membership.
        sql`${webhook.events} @> ${JSON.stringify([eventType])}::jsonb`,
      ),
    );
  if (matching.length === 0) return;

  const eventId = randomUUID();
  const { action, type } = EVENT_SHAPE[eventType];
  const now = new Date();
  const createdAt = now.toISOString();
  const webhookTimestamp = now.getTime();

  await db.insert(webhookDelivery).values(
    matching.map((h) => ({
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
    })),
  );
}
