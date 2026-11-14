import type { CredentialCheck, ToolConfig } from '../../types';
import { KEENABLE_BASE, keenableAuth } from './client';

// Keenable has no request that only checks a key. It reads the key before the request,
// and a failed call costs nothing, so a search with no query is the check: an accepted
// key gets 400 for the missing query, or 402 when its credits are spent.
export async function verifyKeenable(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const res = await fetch(`${KEENABLE_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...keenableAuth(credential) },
    body: '{}',
    signal,
  });
  if (!res.headers.get('content-type')?.includes('json')) return 'unavailable';
  if (res.ok || res.status === 400 || res.status === 402) return 'valid';
  return res.status === 401 ? 'rejected' : 'unavailable';
}
