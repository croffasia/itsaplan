'use client';

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
async function fetchApiKeys(): Promise<ApiKeyRow[]> {
  const { data, error } = await authClient.apiKey.list();
  if (error) throw new Error(error.message ?? 'Could not load API keys.');
  return (data?.apiKeys ?? []).map((key) => ({
    id: key.id,
    name: key.name,
    start: key.start,
    createdAt: new Date(key.createdAt).toISOString(),
  }));
}

export function useApiKeysQuery() {
  return useQuery({ queryKey: qk.apiKeys, queryFn: fetchApiKeys });
}
