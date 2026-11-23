import { pinnedFetch } from '@repo/net';
import type { CredentialCheck, ToolConfig } from '../../types';
import { apiRoot, authHeader } from './client';

// Baserow's own token check. An unknown token answers 401 or 403 with
// ERROR_TOKEN_DOES_NOT_EXIST. The address may be the credential's own instance, so the
// call goes through the SSRF guard.
export async function verifyBaserow(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const res = await pinnedFetch(`${apiRoot(credential)}/api/database/tokens/check/`, {
    headers: { Authorization: authHeader(credential) },
    signal,
  });
  if (res.ok) return 'valid';
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error === 'ERROR_TOKEN_DOES_NOT_EXIST' ? 'rejected' : 'unavailable';
}
