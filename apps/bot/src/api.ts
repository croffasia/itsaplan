import { botConfig } from './config';

// The bot's only data access. It holds no database connection and no encryption key:
// the api owns both and exposes exactly what the bot needs behind the shared
// WORKER_INTERNAL_TOKEN, the same arrangement the worker uses for notification
// delivery.

export interface RemoteBotConfig {
  enabled: boolean;
  botToken: string;
  botUsername: string;
}

export type LinkResult = { ok: true } | { ok: false; reason: 'invalid' | 'taken' };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const cfg = botConfig();
  const res = await fetch(`${cfg.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-worker-token': cfg.internalToken,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

// The instance bot settings. `enabled: false` covers both "no bot configured" and
// "turned off", so the caller only has to check that one flag.
export function fetchBotConfig(): Promise<RemoteBotConfig> {
  return call<RemoteBotConfig>('/internal/telegram/config');
}

// Completes an account link for a `/start <code>` the bot received.
export function confirmLink(input: {
  code: string;
  chatId: string;
  username: string | null;
  firstName: string | null;
}): Promise<LinkResult> {
  return call<LinkResult>('/internal/telegram/link', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
