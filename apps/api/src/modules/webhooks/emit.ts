import { randomUUID } from 'node:crypto';
import { aiAgent, db, user, webhook, webhookDelivery } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import type { ActivityActor } from '#modules/issues/activity';
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
  'comment.updated': { action: 'update', type: 'Comment' },
  'comment.deleted': { action: 'remove', type: 'Comment' },
};

// Who caused the event. An agent acts through its own bot user, so a user id is an
// agent when an ai_agent row points at it. A system write has no user: it carries
// the system's name ('GitHub', 'Auto-archive'), or null for an unnamed one.
interface WebhookActor {
  type: 'human' | 'agent' | 'system';
  id: string | null;
  name: string | null;
}

async function resolveActor(actor: ActivityActor): Promise<WebhookActor> {
  if (!actor) return { type: 'system', id: null, name: null };
  if (typeof actor === 'object') return { type: 'system', id: null, name: actor.system };
  const [row] = await db
    .select({ name: user.name, agentId: aiAgent.id })
    .from(user)
    .leftJoin(aiAgent, eq(aiAgent.userId, user.id))
    .where(eq(user.id, actor))
    .limit(1);
  return { type: row?.agentId != null ? 'agent' : 'human', id: actor, name: row?.name ?? null };
}

// The active webhooks of the project that subscribe to eventType.
export function subscribedWebhooks(projectId: number, eventType: WebhookEventType) {
  return db
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
}

// Fan-out for outgoing webhooks. Queues one delivery per active webhook of the
// project that subscribes to eventType, for each payload `load` returns. Each event
// gets its own eventId, shared by its deliveries and kept across retries so a
// receiver can deduplicate; the deliveries go in as one insert. Call it right after a
// domain mutation, next to the activity log. The payloads are built only after a
// subscribed webhook is found, so a project with no webhooks pays one indexed SELECT.
//
// The body follows Linear's webhook envelope: top-level action, type, actor, data,
// plus createdAt and webhookTimestamp (epoch ms). `event` is our extension, and it
// carries the granular event type. We omit organizationId, because there is no
// organization concept. The shared dedup id goes in the X-Itsaplan-Event-Id header,
// not in the body.
export async function emitWebhookEvents(
  projectId: number,
  eventType: WebhookEventType,
  load: () => Promise<unknown[]>,
  actor: ActivityActor,
): Promise<void> {
  const matching = await subscribedWebhooks(projectId, eventType);
  if (matching.length === 0) return;

  const payloads = await load();
  if (payloads.length === 0) return;

  const { action, type } = EVENT_SHAPE[eventType];
  const resolvedActor = await resolveActor(actor);
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
          actor: resolvedActor,
          createdAt,
          data,
          webhookTimestamp,
          webhookId: h.id,
        },
      }));
    }),
  );
}
