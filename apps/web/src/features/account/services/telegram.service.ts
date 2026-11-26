'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTelegramAccount,
  startTelegramLink,
  unlinkTelegramAccount,
  type TelegramAccount,
} from '@/lib/api/endpoints/telegram';
import { qk } from '@/services/queryKeys';

// The session user's Telegram account link.

// `pollMs` turns on polling while a connection is in progress: the bot writes the
// link out of band, so the page only learns about it by asking again.
export function useTelegramAccountQuery(pollMs?: number) {
  return useQuery({
    queryKey: qk.telegramAccount,
    queryFn: () => getTelegramAccount(),
    refetchInterval: pollMs ?? false,
  });
}

// Starts a connection: the API mints a one-time code and returns the bot deep link
// that completes it when opened.
export function useStartTelegramLink() {
  return useMutation({ mutationFn: () => startTelegramLink() });
}

export function useDisconnectTelegram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unlinkTelegramAccount(),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.telegramAccount }),
  });
}

// An account is connected through the instance bot. A connected one stays without it: the
// bot of a team can still write to it.
export function telegramOffered(account: TelegramAccount): boolean {
  return account.botUsername !== null || account.link !== null;
}

// How to name a connected account: the @username when Telegram has one, otherwise
// the first name, otherwise a plain statement that it is connected.
export function useTelegramAccountLabel() {
  const t = useTranslations('account.accounts');
  return (link: { username: string | null; firstName: string | null }) =>
    link.username ? `@${link.username}` : (link.firstName ?? t('connected'));
}
