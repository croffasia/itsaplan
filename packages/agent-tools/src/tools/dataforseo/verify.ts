import type { CredentialCheck, ToolConfig } from '../../types';
import { DATAFORSEO_BASE, STATUS_OK, dataforseoAuth } from './client';

// Reading the account's own data is free.
export async function verifyDataforseo(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const res = await fetch(`${DATAFORSEO_BASE}/appendix/user_data`, {
    headers: { Authorization: dataforseoAuth(credential) },
    signal,
  });
  if (!res.headers.get('content-type')?.includes('json')) return 'unavailable';
  if (res.status === 401) return 'rejected';
  const body = (await res.json()) as { status_code?: number };
  return res.ok && body.status_code === STATUS_OK ? 'valid' : 'unavailable';
}
