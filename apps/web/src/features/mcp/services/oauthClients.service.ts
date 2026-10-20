'use client';

import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { qk } from '@/services/queryKeys';

// The name an MCP client registered with, or null when it gave none.
async function fetchClientName(clientId: string): Promise<string | null> {
  const { data } = await authClient.$fetch<{ client_name?: string }>('/oauth2/public-client', {
    method: 'GET',
    query: { client_id: clientId },
  });
  return data?.client_name?.trim() || null;
}

export function useOAuthClientNameQuery(clientId: string | null) {
  return useQuery({
    queryKey: qk.oauthClientName(clientId ?? ''),
    queryFn: () => fetchClientName(clientId ?? ''),
    enabled: clientId !== null,
  });
}
