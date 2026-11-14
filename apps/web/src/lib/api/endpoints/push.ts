import { request } from '@/lib/api/core/client';

// Web Push is the instance's: `enabled` is false, and `publicKey` null, while its keys are
// not set. Which events reach a browser is chosen per project in the notification
// preferences.
export interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
}

// A browser the session user turned push on in.
export interface PushDevice {
  id: number;
  endpoint: string;
  createdAt: string;
}

// The part of PushSubscription.toJSON() the api stores.
export interface PushDeviceInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const getPushConfig = () => request<PushConfig>('/push/config');

export const listPushDevices = () => request<PushDevice[]>('/push/subscriptions');

export const savePushDevice = (input: PushDeviceInput) =>
  request<PushDevice>('/push/subscriptions', { method: 'POST', body: JSON.stringify(input) });

export const deletePushDevice = (endpoint: string) =>
  request<void>('/push/subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint }) });
