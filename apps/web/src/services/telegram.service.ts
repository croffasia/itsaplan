'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/services/queryKeys';

// The session user's Telegram account link. Shared rather than feature-local: the
// account page manages the link, and a project's notification preferences show which
// account its Telegram notifications will reach.

// `pollMs` turns on polling while a connection is in progress: the bot writes the
// link out of band, so the page only learns about it by asking again.
export function useTelegramAccountQuery(pollMs?: number) {
  return useQuery({
    queryKey: qk.telegramAccount,
    queryFn: () => api.getTelegramAccount(),
    refetchInterval: pollMs ?? false,
  });
}

// Starts a connection: the API mints a one-time code and returns the bot deep link
// that completes it when opened.
export function useStartTelegramLink() {
  return useMutation({ mutationFn: () => api.startTelegramLink() });
}

export function useDisconnectTelegram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.unlinkTelegramAccount(),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.telegramAccount }),
  });
}

// How to name a connected account: the @username when Telegram has one, otherwise
// the first name, otherwise a plain statement that it is connected.
export function telegramAccountLabel(link: {
  username: string | null;
  firstName: string | null;
}): string {
  if (link.username) return `@${link.username}`;
  return link.firstName ?? 'Connected';
}
