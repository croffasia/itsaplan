import type { CredentialCheck, ToolConfig } from '../../types';
import { jinaAuth } from './auth';

// Jina has no request that only checks a key. The Segmenter is free, and Jina states
// that a key sent to it is never charged, so segmenting one word is the check.
export async function verifyJina(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const res = await fetch('https://api.jina.ai/v1/segment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...jinaAuth(credential) },
    body: JSON.stringify({ content: 'ping' }),
    signal,
  });
  if (res.ok) return 'valid';
  // Jina's bot wall also answers 403, with a page rather than JSON.
  const fromApi = res.headers.get('content-type')?.includes('json');
  return fromApi && (res.status === 401 || res.status === 403) ? 'rejected' : 'unavailable';
}
