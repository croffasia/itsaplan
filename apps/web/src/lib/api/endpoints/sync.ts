import { request } from '@/lib/api/core/client';

// The change markers of every scope the client is watching, in one request.
// Polled by the sync provider; see utils/revScopes.
export const getRevs = (scopes: string[]) =>
  request<{ revs: Record<string, string> }>(`/sync/rev?scopes=${scopes.join(',')}`);
