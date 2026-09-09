import { request } from '@/lib/api/core/client';

// Outgoing webhook subscription (mirrors apps/api modules/webhooks/service.ts). The event
// types must stay in sync with WEBHOOK_EVENT_TYPES on the server.
export type WebhookEventType =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.deleted'
  | 'issue.assigned'
  | 'issue.state_changed'
  | 'issue.label_changed'
  | 'issue.link_changed'
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted';

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  'issue.created',
  'issue.updated',
  'issue.deleted',
  'issue.assigned',
  'issue.state_changed',
  'issue.label_changed',
  'issue.link_changed',
  'comment.created',
  'comment.updated',
  'comment.deleted',
];

export interface Webhook {
  id: number;
  projectId: number;
  url: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  createdAt: string;
}

export interface NewWebhookInput {
  url: string;
  events: WebhookEventType[];
  isActive?: boolean;
}

export interface WebhookPatch {
  url?: string;
  events?: WebhookEventType[];
  isActive?: boolean;
}

// A recorded delivery attempt for the history view. payload is the request body we
// sent; responseStatus/responseBody come from the last attempt; lastError is set
// on a failed or retrying delivery.
export interface WebhookDelivery {
  id: number;
  eventId: string;
  eventType: WebhookEventType;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  payload: unknown;
  responseStatus: number | null;
  responseBody: string | null;
  lastError: string | null;
  nextAttemptAt: string;
  createdAt: string;
}

export interface WebhookDeliveryPage {
  items: WebhookDelivery[];
  nextCursor: number | null;
}

export const listWebhooks = (projectKey: string) =>
  request<Webhook[]>(`/projects/${projectKey}/webhooks`);

export const createWebhook = (projectKey: string, input: NewWebhookInput) =>
  request<Webhook>(`/projects/${projectKey}/webhooks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateWebhook = (webhookId: number, patch: WebhookPatch) =>
  request<Webhook>(`/webhooks/${webhookId}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteWebhook = (webhookId: number) =>
  request<void>(`/webhooks/${webhookId}`, { method: 'DELETE' });

export const listWebhookDeliveries = (webhookId: number, before?: number) =>
  request<WebhookDeliveryPage>(
    `/webhooks/${webhookId}/deliveries?limit=25${before ? `&before=${before}` : ''}`,
  );
