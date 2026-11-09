import { request } from '@/lib/api/core/client';

// The API's limit on scopes per request (MAX_SCOPES in apps/api/src/modules/sync).
const MAX_SCOPES = 20;

// The change markers of every scope the client is watching. Polled by the sync
// provider; see utils/revScopes.
export async function getRevs(scopes: string[]): Promise<{ revs: Record<string, string> }> {
  const batches = [];
  for (let i = 0; i < scopes.length; i += MAX_SCOPES) {
    const batch = scopes.slice(i, i + MAX_SCOPES);
    batches.push(request<{ revs: Record<string, string> }>(`/sync/rev?scopes=${batch.join(',')}`));
  }
  const results = await Promise.all(batches);
  return { revs: Object.assign({}, ...results.map((r) => r.revs)) };
}
