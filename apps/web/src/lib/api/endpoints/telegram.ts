import { request } from '@/lib/api/core/client';

// The session user's Telegram link. `botUsername` is null when no instance bot is
// configured, which is when Telegram is not offered at all; `link` is null while the
// user has not connected an account.
export interface TelegramAccount {
  botUsername: string | null;
  link: { username: string | null; firstName: string | null; linkedAt: string } | null;
}

// The deep link that completes a Telegram connection, and when its code expires.
export interface TelegramLinkStart {
  url: string;
  expiresAt: string;
}

// The session user's own Telegram account link. Starting a link returns the bot
// deep link that completes it; the bot service writes the connection when the user
// opens it.
export const getTelegramAccount = () => request<TelegramAccount>('/telegram/account');

export const startTelegramLink = () =>
  request<TelegramLinkStart>('/telegram/account/link', { method: 'POST' });

export const unlinkTelegramAccount = () => request<void>('/telegram/account', { method: 'DELETE' });
