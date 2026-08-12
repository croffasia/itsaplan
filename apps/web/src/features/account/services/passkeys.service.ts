'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { qk } from '@/services/queryKeys';

// A WebAuthn passkey as returned by the auth API.
export type PasskeyRow = {
  id: string;
  name?: string | null;
  createdAt: string;
  deviceType?: string;
  aaguid?: string | null;
};

// Goes through the auth client, not plain fetch, so better-auth's baseURL and the
// session cookie are reused.
async function fetchPasskeys(loadFailed: string): Promise<PasskeyRow[]> {
  const { data, error } = await authClient.$fetch<PasskeyRow[]>('/passkey/list-user-passkeys');
  if (error) throw new Error(error.message ?? loadFailed);
  return data ?? [];
}

export function usePasskeysQuery() {
  const t = useTranslations('account.security');
  return useQuery({ queryKey: qk.passkeys, queryFn: () => fetchPasskeys(t('passkeysLoadFailed')) });
}
