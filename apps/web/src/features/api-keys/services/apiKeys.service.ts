'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { qk } from '@/services/queryKeys';

// A personal API key as returned by the auth API.
export type ApiKeyRow = {
  id: string;
  name?: string | null;
  start?: string | null;
  createdAt: string;
};

// Goes through the auth client, not plain fetch, so better-auth's baseURL and the
// session cookie are reused. The endpoint returns a paginated
// `{ apiKeys, total, ... }` shape.
async function fetchApiKeys(loadFailed: string): Promise<ApiKeyRow[]> {
  const { data, error } = await authClient.apiKey.list();
  if (error) throw new Error(error.message ?? loadFailed);
  return (data?.apiKeys ?? []).map((key) => ({
    id: key.id,
    name: key.name,
    start: key.start,
    createdAt: new Date(key.createdAt).toISOString(),
  }));
}

export function useApiKeysQuery() {
  const t = useTranslations('apiKeys');
  return useQuery({ queryKey: qk.apiKeys, queryFn: () => fetchApiKeys(t('loadFailed')) });
}
