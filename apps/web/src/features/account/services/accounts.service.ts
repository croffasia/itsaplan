'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/services/queryKeys';
import { useAuthConfigQuery } from '@/services/authConfig.service';
import { linkSocial, listAccounts, unlinkAccount } from '@/lib/auth-client';

// Data for the Accounts page: the sign-in providers connected to the account, read
// and changed through better-auth (so its baseURL and the session cookie are reused).
// The Telegram link is the planner API's own and lives in @/services/telegram.service,
// since the project notification settings show it too.

// One sign-in provider connected to the account, as better-auth reports it.
export interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
}

export function useLinkedAccountsQuery() {
  return useQuery({
    queryKey: qk.linkedAccounts,
    queryFn: async (): Promise<LinkedAccount[]> => {
      const { data, error } = await listAccounts();
      if (error) throw new Error(error.message ?? 'Could not load connected accounts.');
      return (data ?? []) as LinkedAccount[];
    },
  });
}

// Sends the browser to Google and back. The callback returns to this page, so the
// user lands where they started with the new connection visible.
export async function connectGoogle(): Promise<void> {
  const { error } = await linkSocial({
    provider: 'google',
    callbackURL: `${window.location.origin}/account/accounts`,
  });
  if (error) throw new Error(error.message ?? 'Could not connect Google.');
}

export function useDisconnectProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { providerId: string; accountId: string }) => {
      const { error } = await unlinkAccount(input);
      if (error) throw new Error(error.message ?? 'Could not disconnect this account.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.linkedAccounts }),
  });
}

// Whether this instance offers Google at all. The page hides the provider entirely
// when an administrator has not configured it, rather than showing a button that
// fails at Google.
export function useGoogleAvailable(): boolean {
  return useAuthConfigQuery().data?.google ?? false;
}

// The password credential counts as a sign-in method, so disconnecting the last
// social provider is only safe when one exists. better-auth reports it as an account
// with providerId 'credential'.
export function hasPasswordCredential(accounts: LinkedAccount[]): boolean {
  return accounts.some((a) => a.providerId === 'credential');
}
