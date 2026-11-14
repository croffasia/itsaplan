import type { CredentialCheck, ToolConfig } from '../../types';
import { FIRECRAWL_BASE } from './client';

// Reading the team's remaining credits spends none of them.
export async function verifyFirecrawl(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const res = await fetch(`${FIRECRAWL_BASE}/team/credit-usage`, {
    headers: { Authorization: `Bearer ${String(credential.apiKey ?? '')}` },
    signal,
  });
  if (res.ok) return 'valid';
  const fromApi = res.headers.get('content-type')?.includes('json');
  return fromApi && res.status === 401 ? 'rejected' : 'unavailable';
}
