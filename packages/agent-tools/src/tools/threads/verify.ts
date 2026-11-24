import type { CredentialCheck, ToolConfig } from '../../types';
import { THREADS_BASE } from './client';

// The Graph API reports an invalid or expired token as error 190.
export async function verifyThreads(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const url = new URL(`${THREADS_BASE}/me`);
  url.searchParams.set('fields', 'id');
  url.searchParams.set('access_token', String(credential.accessToken ?? ''));
  const res = await fetch(url, { signal });
  const body = (await res.json().catch(() => null)) as { error?: { code?: number } } | null;
  if (body?.error?.code === 190) return 'rejected';
  return res.ok && !body?.error ? 'valid' : 'unavailable';
}
