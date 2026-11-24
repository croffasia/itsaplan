import { request } from '@/lib/api/core/client';

// Outgoing webhook subscription (mirrors apps/api modules/webhooks/service.ts). Its events are
// names from listWebhookEventTypes: the core's, then those the instance adds.
export interface Webhook {
  id: number;
  projectId: number;
  url: string;
  // Null in the list for a caller who may neither create nor edit webhooks.
  secret: string | null;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface NewWebhookInput {
  url: string;
  events: string[];
  isActive?: boolean;
}

export interface WebhookPatch {
  url?: string;
  events?: string[];
  isActive?: boolean;
}

// A recorded delivery attempt for the history view. payload is the request body we
// sent; responseStatus/responseBody come from the last attempt; lastError is set
// on a failed or retrying delivery.
export interface WebhookDelivery {
  id: number;
  eventId: string;
  eventType: string;
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

export const listWebhookEventTypes = (projectKey: string) =>
  request<string[]>(`/projects/${projectKey}/webhooks/event-types`);

export const listWebhooks = (projectKey: string) =>
  request<Webhook[]>(`/projects/${projectKey}/webhooks`);

export const createWebhook = (projectKey: string, input: NewWebhookInput) =>
  request<Webhook>(`/projects/${projectKey}/webhooks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateWebhook = (webhookId: number, patch: WebhookPatch) =>
  request<Webhook>(`/webhooks/${webhookId}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const rotateWebhookSecret = (webhookId: number) =>
  request<Webhook>(`/webhooks/${webhookId}/secret`, { method: 'POST' });

export const deleteWebhook = (webhookId: number) =>
  request<void>(`/webhooks/${webhookId}`, { method: 'DELETE' });

export const listWebhookDeliveries = (webhookId: number, before?: number) =>
  request<WebhookDeliveryPage>(
    `/webhooks/${webhookId}/deliveries?limit=25${before ? `&before=${before}` : ''}`,
  );
