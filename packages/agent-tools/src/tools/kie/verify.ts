import type { CredentialCheck, ToolConfig } from '../../types';
import { KIE_API } from './client';

// Reading the credit balance is free. Kie answers a refused key with HTTP 200 and
// code 401.
export async function verifyKie(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const res = await fetch(`${KIE_API}/chat/credit`, {
    headers: { Authorization: `Bearer ${String(credential.apiKey ?? '')}` },
    signal,
  });
  if (!res.headers.get('content-type')?.includes('json')) return 'unavailable';
  const { code } = (await res.json()) as { code?: number };
  if (code === 200) return 'valid';
  return code === 401 ? 'rejected' : 'unavailable';
}
