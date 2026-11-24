import type { CredentialCheck, ToolConfig } from '../../types';
import { creds, IG_BASE } from './client';

// Reads the account the credential names. The Graph API reports an invalid or expired
// token as error 190, and an account id the token cannot see as error 100.
export async function verifyInstagram(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const { token, igUserId } = creds(credential);
  const url = new URL(`${IG_BASE}/${encodeURIComponent(igUserId)}`);
  url.searchParams.set('fields', 'id');
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { signal });
  const body = (await res.json().catch(() => null)) as { error?: { code?: number } } | null;
  const code = body?.error?.code;
  if (code === 190 || code === 100) return 'rejected';
  return res.ok && !body?.error ? 'valid' : 'unavailable';
}
