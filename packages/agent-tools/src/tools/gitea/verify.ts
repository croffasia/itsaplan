import { pinnedFetch } from '@repo/net';
import type { CredentialCheck, ToolConfig } from '../../types';
import { giteaCredential } from './client';

// The token's own user. The address is the credential's, so the call goes through the
// SSRF guard.
export async function verifyGitea(
  credential: ToolConfig,
  signal: AbortSignal,
): Promise<CredentialCheck> {
  const { baseUrl, token } = giteaCredential(credential);
  const res = await pinnedFetch(`${baseUrl}/api/v1/user`, {
    headers: { Authorization: `token ${token}` },
    signal,
  });
  if (res.ok) return 'valid';
  const fromApi = res.headers.get('content-type')?.includes('json');
  return fromApi && res.status === 401 ? 'rejected' : 'unavailable';
}
